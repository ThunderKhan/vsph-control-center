const test = require("node:test"),
  assert = require("node:assert/strict");
const { validateInvite } = require("../routes/customers");
const org = "22222222-2222-4222-8222-222222222222";
test("individual invitation accepts only explicit organization/product role fields", () => {
  const b = {
    name: "Member",
    email: "USER@example.test",
    memberRole: "member",
    products: [],
  };
  assert.equal(validateInvite(b, org).adminEmail, "user@example.test");
  for (const bad of [
    { ...b, platformRole: "super_admin" },
    { ...b, memberRole: "owner" },
    { ...b, products: [{ applicationId: org, role: "admin", secret: "x" }] },
    {
      ...b,
      products: [
        { applicationId: org, role: "admin" },
        { applicationId: org, role: "viewer" },
      ],
    },
  ])
    assert.throws(() => validateInvite(bad, org));
});
