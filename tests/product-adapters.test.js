const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  adapter,
  canCreateRecord,
  diagnostics,
  payload,
  applicationCookieNames,
} = require("../products/adapters");
test("unknown third product receives safe portal diagnostics and no SQL adapter", () => {
  for (const code of [
    "SANDBOX",
    "__proto__",
    "constructor",
    "crm_contacts;drop table profiles",
  ]) {
    assert.equal(adapter(code), null);
    assert.equal(canCreateRecord(code, "admin"), false);
    assert.equal(payload(code, {}), null);
    assert.equal(diagnostics(code).externalHealth, "unverified");
  }
  assert.equal(diagnostics("SANDBOX").launchPath, "/apps/sandbox/launch");
  assert.equal(diagnostics("SANDBOX").recordsConfigured, false);
});
test("adapter writes preserve role and tenant field allowlists", () => {
  assert.equal(canCreateRecord("CRM", "staff"), false);
  assert.equal(canCreateRecord("MUSIC", "staff"), true);
  assert.equal(canCreateRecord("MUSIC", "musician"), false);
  assert.deepEqual(
    payload("CRM", {
      name: " A ",
      organization_id: "wrong",
      created_by: "admin",
    }),
    { name: "A", email: null, company: null },
  );
  assert.deepEqual(
    payload("MUSIC", { song_title: " Test ", status: "accepted" }),
    { song_title: "Test", artist: null },
  );
});
test("logout discovers valid third-product cookies without hardcoded product names", () => {
  assert.deepEqual(
    applicationCookieNames({
      "vsph.portal.sid": "p",
      "vsph.crm.sid": "c",
      "vsph.sandbox.sid": "s",
      "vsph.bad/path.sid": "bad",
      unrelated: "x",
    }),
    ["vsph.crm.sid", "vsph.sandbox.sid"],
  );
});
