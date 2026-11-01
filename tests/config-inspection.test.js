const test = require("node:test"),
  assert = require("node:assert/strict");
const { inspectConfig } = require("../scripts/inspect-config");
test("local binding inspection reports only public reference and key presence, never secrets", () => {
  const ref = "zbmerhexucqxazuxjmmw",
    env = {
      SUPABASE_URL: "https://" + ref + ".supabase.co",
      SUPABASE_SECRET_KEY: "server-secret-fixture",
      SUPABASE_PUBLISHABLE_KEY: "publishable-fixture",
    };
  const result = inspectConfig(env, ref);
  assert.equal(result.matchesExpectedProject, true);
  assert.equal(result.connectionVerified, false);
  assert.doesNotMatch(
    JSON.stringify(result),
    /server-secret-fixture|publishable-fixture/,
  );
  assert.equal(
    inspectConfig(env, "a".repeat(20)).matchesExpectedProject,
    false,
  );
  for (const url of [
    "https://user:password@example.test",
    "https://example.test/?key=secret",
    "not-a-url",
  ]) {
    const r = inspectConfig({ ...env, SUPABASE_URL: url }, ref);
    assert.equal(r.urlValid, false);
    assert.doesNotMatch(JSON.stringify(r), /password|key=secret|not-a-url/);
  }
});
