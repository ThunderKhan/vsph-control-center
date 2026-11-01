const assert = require("node:assert/strict"),
  crypto = require("node:crypto");
module.exports = async (pool) => {
  const admin = "44444444-4444-4444-8444-444444444444",
    user = "11111111-1111-4111-8111-111111111111";
  const cmd = async (action, id, data = {}, actor = admin) =>
    (
      await pool.query("select product_command($1,$2,$3,$4) data", [
        actor,
        action,
        id,
        data,
      ])
    ).rows[0].data;
  const id = crypto.randomUUID(),
    p = {
      code: "REGISTRY_TEST",
      name: "Registry fixture",
      loginPath: "/apps/registry_test/login",
      status: "active",
      description: "Synthetic",
      ownerId: admin,
      supportEmail: "support@fixture.test",
      docsUrl: "https://example.test/docs",
      visibility: "listed",
      integrationMode: "portal_only",
    };
  const create = await Promise.all([
    cmd("create", id, p),
    cmd("create", id, p),
  ]);
  assert.equal(create[0].id, create[1].id);
  assert.equal(
    (
      await pool.query(
        "select count(*) from audit_logs where action='product.create' and target_id=$1",
        [id],
      )
    ).rows[0].count,
    "1",
  );
  await assert.rejects(
    cmd("create", crypto.randomUUID(), { ...p, secret: "never-store" }),
    { code: "22023" },
  );
  await assert.rejects(cmd("list", null, {}, user), { code: "42501" });
  const updates = await Promise.allSettled(
    [1, 2].map(() => cmd("update", id, { ...p, version: 1, name: "Changed" })),
  );
  assert.equal(updates.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    updates.find((x) => x.status === "rejected").reason.code,
    "40001",
  );
  await cmd("probe", id, {
    version: 2,
    state: "unavailable",
    configured: false,
    reachable: null,
    verified: false,
    scope: "fixture",
    checkedAt: new Date().toISOString(),
  });
  assert.ok((await cmd("list", null)).find((x) => x.id === id).latest_health);
  await assert.rejects(
    cmd("probe", id, { version: 2, state: "verified", verified: true }),
    { code: "22023" },
  );
  // Atomic audit failure rolls back metadata updates.
  await pool.query(
    "create function public.registry_audit_outage() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit outage';end$$;create trigger registry_audit_outage before insert on audit_logs for each row execute function registry_audit_outage()",
  );
  try {
    await assert.rejects(
      cmd("update", id, { ...p, version: 2, name: "Must roll back" }),
      { code: "P0001" },
    );
  } finally {
    await pool.query(
      "drop trigger registry_audit_outage on audit_logs;drop function registry_audit_outage()",
    );
  }
  assert.equal(
    (
      await pool.query("select name,version from applications where id=$1", [
        id,
      ])
    ).rows[0].name,
    "Changed",
  );
  await cmd("update", id, {
    ...p,
    version: 2,
    status: "disabled",
    visibility: "unlisted",
  });
  assert.equal(
    (await pool.query("select status from applications where id=$1", [id]))
      .rows[0].status,
    "disabled",
  );
  await cmd("update", id, { ...p, version: 3, status: "retired" });
  await assert.rejects(
    cmd("update", id, { ...p, version: 4, status: "active" }),
    { code: "22023" },
  );
  const music = (
    await pool.query("select * from applications where code='MUSIC'")
  ).rows[0];
  await assert.rejects(
    cmd("update", music.id, {
      ...p,
      code: "MUSIC",
      loginPath: "/apps/music/login",
      version: music.version,
      integrationMode: "portal_only",
    }),
    { code: "22023" },
  );
  await pool.query(
    "insert into applications(code,name,login_path) select 'ZP_'||lpad(n::text,3,'0'),'Page fixture','/apps/zp_'||lpad(n::text,3,'0')||'/login' from generate_series(1,105) n",
  );
  const first = await cmd("list", null);
  assert.equal(first.length, 100);
  const second = await cmd("list", null, { afterCode: first.at(-1).code });
  assert.ok(second.length > 0);
  assert.equal((await cmd("read", second.at(-1).id)).id, second.at(-1).id);
  for (const role of ["anon", "authenticated"]) {
    const c = await pool.connect();
    try {
      await c.query("set role " + role);
      await assert.rejects(
        c.query("select product_command($1,'list')", [admin]),
        { code: "42501" },
      );
      await assert.rejects(
        c.query("select * from product_health_observations"),
        { code: "42501" },
      );
    } finally {
      await c.query("reset role");
      c.release();
    }
  }
};
