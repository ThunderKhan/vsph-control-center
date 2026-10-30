const test = require("node:test"),
  assert = require("node:assert/strict");
const { validate } = require("../routes/projects");
test("project input rejects ownership confusion and injected permissions", () => {
  assert.throws(() =>
    validate("create", {
      key: "OK",
      name: "One",
      kind: "internal",
      customerOrganizationId: "11111111-1111-4111-8111-111111111111",
    }),
  );
  assert.throws(() =>
    validate("create", {
      key: "OK",
      name: "One",
      kind: "internal",
      platformRole: "super_admin",
    }),
  );
  assert.doesNotThrow(() =>
    validate("create", { key: "OK", name: "One", kind: "internal" }),
  );
});
test("project mutations require versions and safe link schemes", () => {
  assert.throws(() => validate("task.update", { title: "X" }));
  for (const url of ["javascript:alert(1)", "https://user:pass@example.test/a"])
    assert.throws(() =>
      validate("deliverable.create", { version: 1, title: "X", url }),
    );
  assert.doesNotThrow(() =>
    validate("deliverable.create", {
      version: 1,
      title: "X",
      url: "https://example.test/release",
    }),
  );
});
