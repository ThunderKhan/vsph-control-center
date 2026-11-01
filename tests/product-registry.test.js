const test = require("node:test"),
  assert = require("node:assert/strict");
const { validateProduct, readiness } = require("../routes/products");
const p = {
  code: "SANDBOX",
  name: "Sandbox",
  loginPath: "/apps/sandbox/login",
  status: "active",
  visibility: "listed",
  integrationMode: "portal_only",
};
test("registry refuses secret fields, unsafe URLs and mismatched immutable route", () => {
  assert.equal(validateProduct(p).code, "SANDBOX");
  for (const bad of [
    { ...p, privateKey: "secret" },
    { ...p, docsUrl: "https://user:pass@example.test/docs" },
    { ...p, loginPath: "/apps/music/login" },
    { ...p, status: "verified" },
  ])
    assert.throws(() => validateProduct(bad));
});
test("registry never infers verified integration from metadata or public demo availability", () => {
  assert.equal(
    readiness({ code: "MUSIC", status: "active", integration_mode: "adapter" })
      .verified,
    false,
  );
  assert.equal(
    readiness({ code: "CRM", status: "disabled", integration_mode: "adapter" })
      .state,
    "unavailable",
  );
  assert.equal(
    readiness({
      code: "UNKNOWN",
      status: "active",
      integration_mode: "portal_only",
    }).configured,
    false,
  );
});
