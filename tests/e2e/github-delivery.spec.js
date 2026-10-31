const { test, expect } = require("@playwright/test");
test("isolated GitHub fixture connects, syncs, links work, persists and disconnects privately", async ({
  page,
  context,
}, info) => {
  test.setTimeout(90000);
  test.skip(
    !process.env.PROJECT_E2E_DATABASE,
    "Requires isolated PostgreSQL fixture.",
  );
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
    },
  ]);
  const created = await context.request.post("/api/projects", {
    data: {
      key: "GITHUB-" + info.project.name.toUpperCase(),
      name: "GitHub fixture " + info.project.name,
      kind: "internal",
    },
  });
  expect(created.status()).toBe(201);
  const p = await created.json();
  const task = await context.request.post("/api/projects/" + p.id + "/tasks", {
    data: { version: 1, title: "Release acceptance" },
  });
  expect(task.status()).toBe(200);
  await page.goto("/projects/" + p.id);
  await expect(page.locator("#engineering")).toBeVisible();
  await page.getByLabel("GitHub installation ID").fill("77");
  await page
    .getByRole("button", {
      name: "Verify and approve installation",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Approved installation")).toContainText(
    "fixture",
  );
  await page
    .getByRole("button", { name: "Discover repositories", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect fixture/sandbox", exact: true })
    .click();
  await expect(page.locator(".delivery-connections")).toContainText(
    "fixture/sandbox",
  );
  for (let k = 0; k < 7; k++) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/sync") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Synchronize next page", exact: true })
      .click();
    expect((await response).status()).toBe(200);
    await expect(page.locator(".delivery-connections")).toContainText(
      "Checkpoint category " + (k === 6 ? 0 : k + 1),
    );
  }
  await expect(page.locator("#engineeringRecords")).toContainText(
    "Fixture pull request",
  );
  await expect(page.locator("#engineeringRecords")).toContainText("failure");
  await expect(page.locator("#engineeringTimeline")).toContainText(
    "Fixture release",
  );
  await page
    .getByLabel("Link work for Fixture pull request")
    .selectOption({ label: "Task: Release acceptance" });
  const row = page
    .locator("#engineeringRecords tr")
    .filter({ hasText: "Fixture pull request" });
  await row.getByRole("button", { name: "Link", exact: true }).click();
  await expect(row).toContainText("Release acceptance");
  await page.reload();
  await expect(page.locator("#engineeringRecords")).toContainText(
    "Fixture pull request",
  );
  await expect(page.locator("#engineeringTimeline")).toContainText(
    "Fixture build",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator("#engineering").scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("github-delivery.jpg");
  await page.screenshot({ path: screenshot, type: "jpeg", quality: 75 });
  await info.attach("Isolated GitHub provider fixture", {
    path: screenshot,
    contentType: "image/jpeg",
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Disconnect fixture/sandbox", exact: true })
    .click();
  await expect(page.locator("#engineeringRecords")).not.toContainText(
    "Fixture pull request",
  );
  await context.clearCookies();
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-outsider-session",
      url: "http://127.0.0.1:3100",
    },
  ]);
  const denied = await context.request.get(
    "/api/projects/" + p.id + "/delivery",
  );
  expect(denied.status()).toBe(403);
  expect(await denied.text()).not.toContain("fixture/sandbox");
});
