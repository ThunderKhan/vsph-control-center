const { test, expect } = require("@playwright/test");
test("product registry persists versioned metadata and truthful readiness", async ({
  page,
  context,
}, info) => {
  test.skip(
    !process.env.PROJECT_E2E_DATABASE,
    "Requires isolated fixture database",
  );
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/admin/products");
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", { name: "Register product", exact: true })
    .click();
  const code = "REG_" + info.project.name.toUpperCase() + "_" + info.retry;
  await page.getByLabel("Product code", { exact: true }).focus();
  await page.keyboard.type(code);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Product name", { exact: true })).toBeFocused();
  const productName = "Registry " + info.project.name + " " + "x".repeat(100);
  await page.getByLabel("Product name", { exact: true }).fill(productName);
  await page
    .getByLabel("Integration mode", { exact: true })
    .selectOption("portal_only");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.locator("#message")).toContainText("atomic audit");
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("button", { name: "Check reviewed local adapter", exact: true })
    .click();
  await expect(page.locator("#observation")).toContainText("unavailable");
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await page
    .getByLabel("Lifecycle", { exact: true })
    .selectOption("maintenance");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page.getByRole("dialog").getByRole("button",{name:"Continue"}).click();
  await expect(page.locator("#message")).toContainText("atomic audit");
  await page.reload();
  await page.locator("#product").selectOption({
    label: code + " · " + productName + " · maintenance",
  });
  await expect(page.getByLabel("Lifecycle", { exact: true })).toHaveValue(
    "maintenance",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const screenshot = info.outputPath(
    "product-registry-" + info.project.name + ".png",
  );
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach("Product registry", {
    path: screenshot,
    contentType: "image/png",
  });
  await context.clearCookies();
  expect(
    (
      await context.request.get("/api/admin-management/product-registry")
    ).status(),
  ).toBe(401);
});
