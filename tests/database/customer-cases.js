const assert = require("node:assert/strict"),
  crypto = require("node:crypto");
module.exports = async (pool, app) => {
  const actor = "44444444-4444-4444-8444-444444444444",
    user = "11111111-1111-4111-8111-111111111111";
  const cmd = async (fn, action, id, data = {}, who = actor) =>
    (
      await pool.query("select " + fn + "($1,$2,$3,$4) data", [
        who,
        action,
        id,
        data,
      ])
    ).rows[0].data;
  const org = (
    await pool.query(
      "insert into organizations(name,slug) values('Governance','governance-fixture') returning id",
    )
  ).rows[0].id;
  await pool.query(
    "insert into organization_app_access(organization_id,application_id) values($1,$2)",
    [org, app],
  );
  const p = {
      kind: "member",
      organizationId: org,
      adminName: "Existing member",
      adminEmail: "fixture@example.test",
      memberRole: "viewer",
      products: [{ applicationId: app, role: "musician" }],
    },
    key = crypto.randomUUID();
  const r = await Promise.all([
    cmd("provisioning_command", "begin_member", key, p),
    cmd("provisioning_command", "begin_member", key, p),
  ]);
  assert.equal(r[0].id, r[1].id);
  await assert.rejects(
    cmd("provisioning_command", "begin_member", crypto.randomUUID(), p),
    { code: "23505" },
  );
  await assert.rejects(cmd("customer_command", "read", org, {}, user), {
    code: "42501",
  });
  const inv = (
    await pool.query("select * from membership_invitations where job_id=$1", [
      r[0].id,
    ])
  ).rows[0];
  const lease = crypto.randomUUID();
  await pool.query(
    "update invitation_outbox set state='leased',lease_token=$1,lease_until=now()+interval '1 minute' where invitation_id=$2",
    [lease, inv.id],
  );
  const ob = (
    await pool.query(
      "select id from invitation_outbox where invitation_id=$1",
      [inv.id],
    )
  ).rows[0].id;
  await cmd(
    "provisioning_command",
    "bind",
    ob,
    {
      lease,
      userId: user,
      tokenHash: "c".repeat(64),
      encryptedDelivery: "fixture",
    },
    null,
  );
  await cmd("provisioning_command", "sent", ob, { lease }, null);
  const crm = (await pool.query("select id from applications where code='CRM'"))
    .rows[0].id;
  await pool.query(
    "insert into organization_app_access(organization_id,application_id) values($1,$2)",
    [org, crm],
  );
  await assert.rejects(
    cmd("provisioning_command", "begin_member", crypto.randomUUID(), {
      ...p,
      adminEmail: "wrong-role@fixture.test",
      products: [{ applicationId: crm, role: "staff" }],
    }),
    { code: "42501" },
  );
  const detail = await cmd("customer_command", "read", org);
  assert.equal(detail.members[0].role, "viewer");
  assert.equal(detail.members[0].status, "invited");
  assert.ok(!JSON.stringify(detail).includes("token_hash"));
  await assert.rejects(
    cmd(
      "provisioning_command",
      "reserve_accept",
      inv.id,
      { tokenHash: "c".repeat(64), acceptanceId: crypto.randomUUID() },
      actor,
    ),
    { code: "42501" },
  );
  await pool.query(
    "update membership_invitations set expires_at=now()-interval '1 minute' where id=$1",
    [inv.id],
  );
  await assert.rejects(
    cmd(
      "provisioning_command",
      "inspect",
      inv.id,
      { tokenHash: "c".repeat(64) },
      null,
    ),
    { code: "42501" },
  );
  const renew = await Promise.allSettled(
    [1, 2].map(() =>
      cmd("provisioning_command", "reissue", inv.id, { generation: 1 }),
    ),
  );
  assert.equal(renew.filter((x) => x.status === "fulfilled").length, 1);
  await assert.rejects(
    cmd(
      "provisioning_command",
      "inspect",
      inv.id,
      { tokenHash: "c".repeat(64) },
      null,
    ),
    { code: "42501" },
  );
  const lease2 = crypto.randomUUID();
  await pool.query(
    "update invitation_outbox set state='leased',lease_token=$1,lease_until=now()+interval '1 minute' where id=$2",
    [lease2, ob],
  );
  await cmd(
    "provisioning_command",
    "bind",
    ob,
    {
      lease: lease2,
      userId: user,
      tokenHash: "d".repeat(64),
      encryptedDelivery: "fixture",
    },
    null,
  );
  await cmd("provisioning_command", "sent", ob, { lease: lease2 }, null);
  await assert.rejects(
    cmd("provisioning_command", "revoke", inv.id, { generation: 1 }),
    { code: "40001" },
  );
  await cmd("provisioning_command", "revoke", inv.id, { generation: 2 });
  await cmd("provisioning_command", "reissue", inv.id, { generation: 2 });
  const lease3 = crypto.randomUUID();
  await pool.query(
    "update invitation_outbox set state='leased',lease_token=$1,lease_until=now()+interval '1 minute' where id=$2",
    [lease3, ob],
  );
  await cmd(
    "provisioning_command",
    "bind",
    ob,
    {
      lease: lease3,
      userId: user,
      tokenHash: "d".repeat(64),
      encryptedDelivery: "fixture",
    },
    null,
  );
  await cmd("provisioning_command", "sent", ob, { lease: lease3 }, null);
  const aid = crypto.randomUUID();
  await cmd(
    "provisioning_command",
    "reserve_accept",
    inv.id,
    { tokenHash: "d".repeat(64), acceptanceId: aid },
    user,
  );
  await cmd(
    "provisioning_command",
    "finish_accept",
    inv.id,
    { acceptanceId: aid },
    user,
  );
  assert.equal(
    (
      await pool.query(
        "select role_code from user_app_roles where organization_id=$1 and user_id=$2",
        [org, user],
      )
    ).rows[0].role_code,
    "musician",
  );
  const updates = await Promise.allSettled(
    [1, 2].map(() =>
      cmd("customer_command", "role", org, {
        userId: user,
        version: 1,
        applicationId: app,
        role: "",
      }),
    ),
  );
  assert.equal(updates.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (
      await pool.query(
        "select * from user_app_roles where organization_id=$1 and user_id=$2",
        [org, user],
      )
    ).rowCount,
    0,
  );
  await cmd("customer_command", "member", org, {
    userId: user,
    version: 2,
    role: "viewer",
    status: "suspended",
  });
  await assert.rejects(
    cmd("customer_command", "role", org, {
      userId: user,
      version: 3,
      applicationId: app,
      role: "admin",
    }),
    { code: "42501" },
  );

  const { hashToken } = require("../../tokens");
  await pool.query(
    "insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",
    [hashToken("customer-http-admin"), actor],
  );
  const server = require("./http-fixture")(pool).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal(
      (await fetch(base + "/api/admin-management/customers/" + org)).status,
      401,
    );
    const h = {
      Cookie: "vsph.portal.sid=customer-http-admin",
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    };
    assert.equal(
      (
        await fetch(base + "/api/admin-management/customers/" + org, {
          headers: h,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(
          base + "/api/admin-management/customers/" + org + "/invitations",
          {
            method: "POST",
            headers: h,
            body: JSON.stringify({
              name: "Bad",
              email: "bad@fixture.test",
              memberRole: "super_admin",
              products: [],
            }),
          },
        )
      ).status,
      400,
    );
    await pool.query(
      "update portal_sessions set expires_at=now()-interval '1 minute' where token_hash=$1",
      [hashToken("customer-http-admin")],
    );
    assert.equal(
      (
        await fetch(base + "/api/admin-management/customers/" + org, {
          headers: h,
        })
      ).status,
      401,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
  for (const role of ["anon", "authenticated"]) {
    const c = await pool.connect();
    try {
      await c.query("set role " + role);
      await assert.rejects(
        c.query("select customer_command($1,'read',$2)", [actor, org]),
        { code: "42501" },
      );
    } finally {
      await c.query("reset role");
      c.release();
    }
  }
};
