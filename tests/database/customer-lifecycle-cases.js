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
  // Hold bind before its membership FK check while suspension waits for the invitation.
  // NO KEY UPDATE must permit the FK's KEY SHARE and avoid an org/invitation deadlock.
  const raceOrg = (
    await pool.query(
      "insert into organizations(name,slug) values('Enrollment suspension race','enrollment-suspension-race') returning id",
    )
  ).rows[0].id;
  const job = (
    await pool.query(
      "select provisioning_command($1,'begin_member',$2,$3) data",
      [
        admin,
        crypto.randomUUID(),
        {
          kind: "member",
          organizationId: raceOrg,
          adminName: "Race enrollment",
          adminEmail: "suspend-enroll@fixture.test",
          memberRole: "member",
          products: [],
        },
      ],
    )
  ).rows[0].data;
  const invitation = (
    await pool.query("select * from membership_invitations where job_id=$1", [
      job.id,
    ])
  ).rows[0];
  await pool.query("insert into auth.users(id) values($1)", [
    invitation.auth_user_id,
  ]);
  const outbox = (
      await pool.query(
        "select id from invitation_outbox where invitation_id=$1",
        [invitation.id],
      )
    ).rows[0].id,
    lease = crypto.randomUUID();
  await pool.query(
    "update invitation_outbox set state='leased',lease_token=$1,lease_until=now()+interval '1 minute' where id=$2",
    [lease, outbox],
  );
  await pool.query(
    "create function public.fixture_bind_gate() returns trigger language plpgsql as $$begin if new.organization_id::text=TG_ARGV[0] then perform pg_advisory_xact_lock(42424242);end if;return new;end$$",
  );
  await pool.query(
    "create trigger fixture_bind_gate before insert on organization_memberships for each row execute function fixture_bind_gate('" +
      raceOrg +
      "')",
  );
  const gate = await pool.connect(),
    binder = await pool.connect(),
    suspender = await pool.connect();
  async function waitFor(query, args) {
    for (let i = 0; i < 200; i++) {
      if ((await pool.query(query, args)).rows[0].ready) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("Fixture lock gate was not reached");
  }
  try {
    const bindPid = (await binder.query("select pg_backend_pid() id")).rows[0]
        .id,
      stopPid = (await suspender.query("select pg_backend_pid() id")).rows[0]
        .id;
    await gate.query("begin");
    await gate.query("select pg_advisory_xact_lock(42424242)");
    await binder.query("begin;set local statement_timeout='8s'");
    const binding = binder.query(
      "select provisioning_command(null,'bind',$1,$2)",
      [
        outbox,
        {
          lease,
          userId: invitation.auth_user_id,
          tokenHash: "f".repeat(64),
          encryptedDelivery: "fixture",
        },
      ],
    );
    binding.catch(() => {});
    await waitFor(
      "select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) ready",
      [bindPid],
    );
    await suspender.query("set statement_timeout='10s'");
    const stopping = suspender.query(
      "select customer_lifecycle($1,'status',$2,$3)",
      [admin, raceOrg, { version: 1, confirmed: true, status: "suspended" }],
    );
    stopping.catch(() => {});
    await waitFor(
      "select exists(select 1 from pg_stat_activity where pid=$1 and wait_event_type='Lock') ready",
      [stopPid],
    );
    await gate.query("rollback");
    await binding;
    await binder.query("commit");
    await stopping;
    assert.equal(
      (
        await pool.query(
          "select state from membership_invitations where id=$1",
          [invitation.id],
        )
      ).rows[0].state,
      "revoked",
    );
  } finally {
    await gate.query("rollback");
    await binder.query("rollback");
    gate.release();
    binder.release();
    suspender.release();
    await pool.query(
      "drop trigger fixture_bind_gate on organization_memberships;drop function fixture_bind_gate()",
    );
  }
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
