const { test, expect } = require("@playwright/test");
test("authenticated customer wizard commits queued work without sending mail", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    !process.env.PROJECT_E2E_DATABASE,
    "Requires isolated database fixtures.",
  );
  test.setTimeout(60000);
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/admin/onboarding");
  await page
    .locator("#orgName")
    .fill("Wizard fixture " + testInfo.project.name);
  await page.locator("#nextButton").click();
  await page.locator("#adminName").fill("Synthetic Customer Owner");
  await page
    .locator("#adminEmail")
    .fill("wizard-" + testInfo.project.name + "@fixture.test");
  await page.locator("#nextButton").click();
  await page.locator("#productChoices input").first().check();
  await page.locator("#nextButton").click();
  await page.locator("#nextButton").click();
  await page.locator("#confirm").check();
  await page.locator("#nextButton").click();
  await expect(page.locator("#completeScreen")).toBeVisible();
  await expect(page.locator("#completeMessage")).toContainText("queued");
  const jobs = await context.request.get("/api/admin-management/onboardings");
  expect(jobs.status()).toBe(200);
  const rows = await jobs.json();
  expect(
    rows.some(
      (j) =>
        j.email === "wizard-" + testInfo.project.name + "@fixture.test" &&
        j.state === "queued",
    ),
  ).toBe(true);
  await page.goto("/admin/provisioning");
  await expect(page.locator("#jobs")).toContainText(
    "wizard-" + testInfo.project.name + "@fixture.test",
  );
  await expect(page.locator("#jobs")).toContainText("queued");
});
