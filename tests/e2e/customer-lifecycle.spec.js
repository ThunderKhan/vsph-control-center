const { test, expect } = require("@playwright/test"),
  crypto = require("node:crypto");
test("customer lifecycle confirms impact, persists terms and revokes access safely", async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.PROJECT_E2E_DATABASE, "Requires isolated DB");
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const lookup = await (
      await context.request.get("/api/admin-management/lookups")
    ).json(),
    suffix = info.project.name + "-" + info.retry;
  const r = await context.request.post("/api/admin-management/onboardings", {
    headers: {
      Origin: "http://127.0.0.1:3100",
      "Idempotency-Key": crypto.randomUUID(),
    },
    data: {
      organizationName: "Lifecycle " + suffix,
      slug: "lifecycle-" + suffix,
      adminName: "Synthetic owner",
      adminEmail: "lifecycle-" + suffix + "@fixture.test",
      products: [
        {
          applicationId: lookup.applications[0].id,
          planCode: "standard",
          status: "active",
          endsAt: null,
        },
      ],
    },
  });
  expect(r.status()).toBe(202);
  const org = (await r.json()).id;
  await page.goto("/admin/customers");
  await page.locator("#customer").selectOption(org);
  await expect(page.locator("#impact")).toContainText("pending invitations");
  await expect(page.locator("#detail")).toHaveAttribute("aria-busy", "false");
  page.on("dialog", (d) => d.accept());
  await page
    .getByLabel("Organization lifecycle", { exact: true })
    .selectOption("suspended");
  await page
    .getByRole("button", { name: "Review and save lifecycle", exact: true })
    .click();
  await expect(page.locator("#state")).toContainText("suspended");
  await expect(page.locator("#detail")).toHaveAttribute("aria-busy", "false");
  await page
    .getByLabel("Organization lifecycle", { exact: true })
    .selectOption("active");
  await page
    .getByRole("button", { name: "Review and save lifecycle", exact: true })
    .click();
  await expect(page.locator("#state")).toContainText("active");
  await expect(page.locator("#detail")).toHaveAttribute("aria-busy", "false");
  await page
    .getByLabel("Product entitlement", { exact: true })
    .selectOption(lookup.applications[0].id);
  await page.getByLabel("Plan code", { exact: true }).fill("renewed");
  await page
    .getByLabel("Access grant", { exact: true })
    .selectOption("revoked");
  await page
    .getByRole("button", { name: "Review and save entitlement", exact: true })
    .click();
  await expect(page.locator("#products")).toContainText("renewed");
  await expect(page.locator("#products")).toContainText("revoked");
  await page.reload();
  await page.locator("#customer").selectOption(org);
  await expect(page.locator("#products")).toContainText("renewed");
  await expect(page.locator("#activity")).toContainText(
    "customer.entitlement_updated",
  );
});
