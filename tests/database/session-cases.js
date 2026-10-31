const assert = require("node:assert/strict");
module.exports = async (pool) => {
  const user = "11111111-1111-4111-8111-111111111111",
    other = "44444444-4444-4444-8444-444444444444";
  const call = async (action, id = null, hash = "own-current", actor = user) =>
    (
      await pool.query("select session_command($1,$2,$3,$4) data", [
        actor,
        action,
        id,
        { currentHash: hash },
      ])
    ).rows[0].data;
  for (const [hash, id] of [
    ["own-current", user],
    ["own-other", user],
    ["foreign-private", other],
  ])
    await pool.query(
      "insert into portal_sessions(token_hash,user_id,expires_at)values($1,$2,now()+interval '1 hour')",
      [hash, id],
    );
  const list = await call("list");
  assert.ok(list.sessions.every((x) => !("token_hash" in x)));
  assert.equal(list.sessions.filter((s) => s.current_session).length, 1);
  const foreign = (
    await pool.query(
      "select public_id from portal_sessions where token_hash='foreign-private'",
    )
  ).rows[0].public_id;
  assert.equal((await call("revoke", foreign)).revoked, 0);
  assert.equal(
    (await call("revoke", list.sessions.find((s) => s.current_session).id))
      .revoked,
    0,
  );
  await assert.rejects(call("list", null, "foreign-private"), {
    code: "42501",
  });
  const org = (
      await pool.query(
        "select id from organizations where slug='adapter-fixture'",
      )
    ).rows[0].id,
    app = (await pool.query("select id from applications where code='SANDBOX'"))
      .rows[0].id;
  await pool.query(
    "insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at)values('own-nested-app','own-other',$1,$2,$3,now()+interval '1 hour')",
    [user, org, app],
  );
  await call("revoke_others");
  assert.equal(
    (
      await pool.query(
        "select * from app_sessions where token_hash='own-nested-app'",
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "select * from portal_sessions where token_hash='foreign-private'",
      )
    ).rowCount,
    1,
  );
  await assert.rejects(call("revoke_others", null, "own-other"), {
    code: "42501",
  });
  await pool.query(
    "insert into portal_sessions(token_hash,user_id,expires_at)values('race-session-a',$1,now()+interval '1 hour'),('race-session-b',$1,now()+interval '1 hour')",
    [user],
  );
  const race = await Promise.allSettled([
    call("revoke_others", null, "race-session-a"),
    call("revoke_others", null, "race-session-b"),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(race.find((r) => r.status === "rejected").reason.code, "42501");
};
