const { test, expect } = require("@playwright/test");
test("self-service session inventory and revoke others keep current portal access", async ({
  page,
  context,
}) => {
  test.skip(!process.env.PROJECT_E2E_DATABASE, "Requires isolated DB");
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/account/security");
  await expect(page.locator("#sessionList")).toContainText("Current session");
  await page
    .getByRole("button", { name: "Revoke Other Sessions", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out others" }).click();
  await expect(page.locator("#sessionMessage")).toContainText(
    "current session remains active",
  );
  await expect(page.locator("#sessionList")).not.toContainText("Other session");
  expect((await context.request.get("/api/auth/me")).status()).toBe(200);
});
