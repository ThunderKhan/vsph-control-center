const { test, expect } = require("@playwright/test");
const crypto = require("node:crypto");
test("customer workspace queues scoped invitations and rotates or cancels them without sending email", async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.PROJECT_E2E_DATABASE, "Requires isolated database");
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const headers = {
    Origin: "http://127.0.0.1:3100",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const lookups = await (
    await context.request.get("/api/admin-management/lookups")
  ).json();
  const suffix = info.project.name + "-" + info.retry;
  const result = await context.request.post(
    "/api/admin-management/onboardings",
    {
      headers,
      data: {
        organizationName: "Governance " + suffix,
        slug: "governance-" + suffix,
        adminName: "Fixture Owner",
        adminEmail: "owner-" + suffix + "@fixture.test",
        products: [
          {
            applicationId: lookups.applications[0].id,
            planCode: "standard",
            status: "active",
            endsAt: null,
          },
        ],
      },
    },
  );
  expect(result.status()).toBe(202);
  const org = (await result.json()).id;
  await page.goto("/admin/customers");
  await page.locator("#customer").selectOption(org);
  await expect(page.locator("#name")).toHaveText("Governance " + suffix);
  await expect(page.locator("#newCustomerProject")).toHaveAttribute("href","/projects?organizationId="+org);
  await page.getByLabel("Full name", { exact: true }).fill("Fixture Developer");
  await page
    .getByLabel("Email", { exact: true })
    .fill("developer@fixture.test");
  await page
    .getByRole("button", { name: "Queue invitation", exact: true })
    .click();
  await expect(page.locator("#message")).toContainText("queued");
  await expect(page.locator("#invitations")).toContainText(
    "developer@fixture.test",
  );
  await page
    .getByRole("button", {
      name: "Reissue developer@fixture.test",
      exact: true,
    })
    .click();
  await page.getByRole("dialog").getByRole("button",{name:"Continue"}).click();
  await expect(page.locator("#message")).toContainText("updated");
  await expect(page.locator("#detail")).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", { name: "Cancel developer@fixture.test", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button",{name:"Continue"}).click();
  await expect(page.locator("#invitations")).toContainText("revoked");
  await page.reload();
  await page.locator("#customer").selectOption(org);
  await expect(page.locator("#invitations")).toContainText("revoked");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.clearCookies();
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-outsider-session",
      url: "http://127.0.0.1:3100",
    },
  ]);
  expect(
    (
      await context.request.get("/api/admin-management/customers/" + org)
    ).status(),
  ).toBe(403);
});
