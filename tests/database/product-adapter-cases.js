const assert = require("node:assert/strict"),
  { once } = require("node:events"),
  { hashToken } = require("../../tokens");
module.exports = async (pool) => {
  const user = "11111111-1111-4111-8111-111111111111";
  const org = (
    await pool.query(
      "insert into organizations(name,slug)values('Adapter fixture','adapter-fixture')returning id",
    )
  ).rows[0].id;
  const app = (
    await pool.query(
      "insert into applications(code,name,login_path)values('SANDBOX','Sandbox product','/apps/sandbox/login')returning id",
    )
  ).rows[0].id;
  await pool.query(
    "insert into app_roles(application_id,code,name)values($1,'viewer','Viewer')",
    [app],
  );
  await pool.query(
    "insert into organization_memberships(organization_id,user_id)values($1,$2)",
    [org, user],
  );
  await pool.query(
    "insert into subscriptions(organization_id,application_id,status)values($1,$2,'active')",
    [org, app],
  );
  await pool.query(
    "insert into organization_app_access(organization_id,application_id)values($1,$2)",
    [org, app],
  );
  await pool.query(
    "insert into user_app_roles(organization_id,user_id,application_id,role_code)values($1,$2,$3,'viewer')",
    [org, user, app],
  );
  await pool.query(
    "insert into portal_sessions(token_hash,user_id,expires_at)values($1,$2,now()+interval '1 hour')",
    [hashToken("adapter-portal"), user],
  );
  await pool.query(
    "insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at)values($1,$2,$3,$4,$5,now()+interval '1 hour')",
    [hashToken("adapter-app"), hashToken("adapter-portal"), user, org, app],
  );
  const application = require("./http-fixture")(pool),
    server = application.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = {
    cookie: "vsph.portal.sid=adapter-portal; vsph.sandbox.sid=adapter-app",
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
  };
  try {
    const context = await fetch(base + "/api/apps/SANDBOX/context", {
      headers,
    });
    assert.equal(context.status, 200);
    const data = await context.json();
    assert.equal(data.integration.adapter, "portal-only");
    assert.equal(data.integration.externalHealth, "unverified");
    assert.equal(data.capabilities.createRecords, false);
    const records = await fetch(base + "/api/apps/SANDBOX/records", {
      headers,
    });
    assert.deepEqual(await records.json(), { records: [], configured: false });
    await pool.query(
      "update organization_app_access set status='revoked'where organization_id=$1 and application_id=$2",
      [org, app],
    );
    assert.equal(
      (await fetch(base + "/api/apps/SANDBOX/context", { headers })).status,
      403,
    );
    const logout = await fetch(base + "/api/auth/logout", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /vsph\.sandbox\.sid=;/);
    assert.equal(
      (
        await pool.query("select * from app_sessions where application_id=$1", [
          app,
        ])
      ).rowCount,
      0,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
};
