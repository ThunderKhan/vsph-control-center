const { test, expect } = require("@playwright/test"),
  crypto = require("node:crypto");
test("refreshing entitlement versions preserves the selected customer and product", async ({
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
  const apps = (
      await (await context.request.get("/api/admin-management/lookups")).json()
    ).applications,
    music = apps.find((a) => a.code === "MUSIC"),
    suffix = info.project.name + "-" + info.retry;
  let target;
  for (const prefix of ["AA", "ZZ"]) {
    const r = await context.request.post("/api/admin-management/onboardings", {
      headers: {
        Origin: "http://127.0.0.1:3100",
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        organizationName: prefix + " selection " + suffix,
        slug: prefix.toLowerCase() + "-selection-" + suffix,
        adminName: "Selection fixture",
        adminEmail:
          prefix.toLowerCase() + "-selection-" + suffix + "@fixture.test",
        products: [
          {
            applicationId: music.id,
            planCode: "standard",
            status: "active",
            endsAt: null,
          },
        ],
      },
    });
    expect(r.status()).toBe(202);
    if (prefix === "ZZ") target = (await r.json()).id;
  }
  await page.goto("/admin");
  await page.locator('[data-tab="subscriptions"]').click();
  await page.locator("#subOrg").selectOption(target);
  await page.locator("#subApp").selectOption(music.id);
  await page.locator("#subStatus").selectOption("active");
  for (const plan of ["selection-plan", "selection-plan-2"]) {
    await page.locator("#subPlan").fill(plan);
    await page
      .locator("#subscriptionForm")
      .getByRole("button", { name: "Save subscription", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("button",{name:"Save subscription"}).click();
    await expect(page.locator("#globalMessage")).toHaveText(
      "Subscription saved.",
    );
    await expect(page.locator("#subOrg")).toHaveValue(target);
    await expect(page.locator("#subApp")).toHaveValue(music.id);
  }
  const record = await (
    await context.request.get("/api/admin-management/customers/" + target)
  ).json();
  expect(record.products.find((p) => p.id === music.id).plan_code).toBe(
    "selection-plan-2",
  );
});
