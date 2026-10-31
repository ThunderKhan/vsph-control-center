const test = require("node:test"),
  assert = require("node:assert/strict");
test("restore rehearsal refuses non-CI, hosted or unidentified database targets", async () => {
  const { target } = await import("../scripts/rehearse-restore.mjs");
  assert.throws(() => target({}));
  const env = {
    CI: "true",
    VSPH_RESTORE_REHEARSAL: "true",
    TEST_DATABASE_URL: "postgres://postgres:fixture@127.0.0.1:5432/vsph_test",
    VSPH_CI_POSTGRES_CONTAINER: "a".repeat(64),
  };
  assert.equal(target(env).url.pathname, "/vsph_test");
  for (const change of [
    { CI: "false" },
    {
      TEST_DATABASE_URL:
        "postgres://postgres:fixture@127.0.0.1:5432/vsph_test?host=remote.example.test",
    },
    {
      TEST_DATABASE_URL:
        "postgres://postgres:fixture@host.example.test:5432/vsph_test",
    },
    {
      TEST_DATABASE_URL:
        "postgres://postgres:fixture@127.0.0.1:5432/production",
    },
    { VSPH_CI_POSTGRES_CONTAINER: "wrong" },
  ])
    assert.throws(() => target({ ...env, ...change }));
});
