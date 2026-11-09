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

test("custom-development customer onboarding creates an organization and owner invitation with no product grants",async({page,context},testInfo)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,"Requires isolated database fixtures.");
 await context.addCookies([{name:"vsph.portal.sid",value:"fixture-admin-session",url:"http://127.0.0.1:3100",httpOnly:true,sameSite:"Lax"}]);
 await page.goto("/admin/onboarding");
 const unique="custom-org-"+testInfo.project.name+"-"+Date.now().toString(36);
 await page.locator("#orgName").fill(unique);
 await page.locator("#nextButton").click();
 await page.locator("#adminName").fill("Custom Customer Owner");
 const email=unique+"@fixture.test";
 await page.locator("#adminEmail").fill(email);
 await page.locator("#nextButton").click();
 await page.locator("#customOnly").check();
 await expect(page.locator("#productChoices input:checked")).toHaveCount(0);
 await page.locator("#nextButton").click();
 await expect(page.locator("#stepIndicator")).toContainText("STEP 4 OF 4");
 await expect(page.locator("#reviewDetails")).toContainText("no catalog subscription");
 await page.locator("#confirm").check();
 await page.locator("#nextButton").click();
 await expect(page.locator("#completeScreen")).toBeVisible();
 await expect(page.locator("#completeMessage")).toContainText("without a product subscription");
 const jobs=await (await context.request.get("/api/admin-management/onboardings")).json();
 expect(jobs.some(row=>row.email===email&&row.state==="queued")).toBe(true);
});
