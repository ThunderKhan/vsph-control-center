const assert = require("node:assert/strict"),
  crypto = require("node:crypto");
module.exports = async (pool, app) => {
  const admin = "44444444-4444-4444-8444-444444444444",
    user = "11111111-1111-4111-8111-111111111111";
  const org = (
    await pool.query(
      "insert into organizations(name,slug) values('Lifecycle fixture','customer-lifecycle') returning id",
    )
  ).rows[0].id;
  const cmd = async (action, data = {}, actor = admin) =>
    (
      await pool.query("select customer_lifecycle($1,$2,$3,$4) data", [
        actor,
        action,
        org,
        data,
      ])
    ).rows[0].data;
  await assert.rejects(cmd("preview", {}, user), { code: "42501" });
  await assert.rejects(cmd("status", { version: 1, status: "suspended" }), {
    code: "22023",
  });
  const terms = {
    version: 1,
    confirmed: true,
    applicationId: app,
    planCode: "standard",
    subscriptionStatus: "trial",
    accessStatus: "enabled",
    endsAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const race = await Promise.allSettled(
    [1, 2].map(() => cmd("entitlement", terms)),
  );
  assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(race.find((x) => x.status === "rejected").reason.code, "40001");
  await assert.rejects(
    cmd("entitlement", { ...terms, version: 2, endsAt: null }),
    { code: "22023" },
  );
  assert.equal((await cmd("preview")).version, 2);
  await pool.query(
    "create function public.customer_audit_outage() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit outage';end$$;create trigger customer_audit_outage before insert on audit_logs for each row execute function customer_audit_outage()",
  );
  try {
    await assert.rejects(
      cmd("status", { version: 2, confirmed: true, status: "suspended" }),
      { code: "P0001" },
    );
  } finally {
    await pool.query(
      "drop trigger customer_audit_outage on audit_logs;drop function customer_audit_outage()",
    );
  }
  assert.equal((await cmd("preview")).status, "active");
  await pool.query(
    "insert into portal_sessions(token_hash,user_id,expires_at) values('lifecycle-session-race',$1,now()+interval '1 hour')",
    [user],
  );
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select customer_lifecycle($1,'status',$2,$3)", [
      admin,
      org,
      { version: 2, confirmed: true, status: "suspended" },
    ]);
    const insert = pool
      .query(
        "insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values('racing-lifecycle-app','lifecycle-session-race',$1,$2,$3,now()+interval '1 hour')",
        [user, org, app],
      )
      .catch((e) => e);
    await c.query("commit");
    assert.equal((await insert).code, "42501");
  } finally {
    await c.query("rollback");
    c.release();
  }
  assert.equal(
    (
      await pool.query(
        "select count(*) from app_sessions where organization_id=$1",
        [org],
      )
    ).rows[0].count,
    "0",
  );
  await cmd("status", { version: 3, confirmed: true, status: "active" });
  assert.equal((await cmd("preview")).status, "active");
  assert.equal(
    (
      await pool.query(
        "select count(*) from app_sessions where organization_id=$1",
        [org],
      )
    ).rows[0].count,
    "0",
  );
  await cmd("status", { version: 4, confirmed: true, status: "closed" });
  await assert.rejects(
    cmd("status", { version: 5, confirmed: true, status: "active" }),
    { code: "22023" },
  );
  for (const role of ["anon", "authenticated"]) {
    const c = await pool.connect();
    try {
      await c.query("set role " + role);
      await assert.rejects(
        c.query("select customer_lifecycle($1,'preview',$2)", [admin, org]),
        { code: "42501" },
      );
    } finally {
      await c.query("reset role");
      c.release();
    }
  }
};
