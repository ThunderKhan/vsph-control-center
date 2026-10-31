const { test, expect } = require("@playwright/test");
test("project inbox preferences and reports persist with scoped assignments", async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.PROJECT_E2E_DATABASE, "Requires isolated database");
  await context.setExtraHTTPHeaders({ Origin: "http://127.0.0.1:3100" });
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
    },
  ]);
  const r = await context.request.post("/api/projects", {
    data: {
      key: "INBOX-" + info.project.name.toUpperCase(),
      name: "Inbox fixture " + info.project.name,
      kind: "internal",
    },
  });
  const p = await r.json();
  expect(
    (
      await context.request.post("/api/projects/" + p.id + "/tasks", {
        data: {
          version: 1,
          title: "Assignment notification " + info.project.name,
          assigneeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/projects");
  await page.locator("#projectOperations summary").click();
  await expect(page.locator("#notificationList")).toContainText(
    "Assignment notification " + info.project.name,
  );
  const notice = page
    .locator("#notificationList li")
    .filter({ hasText: "Assignment notification " + info.project.name });
  await notice.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(notice).toContainText("Read");
  await page
    .locator('#notificationPreferences input[name="delivery"]')
    .uncheck();
  await page
    .getByRole("button", { name: "Save notification preferences", exact: true })
    .click();
  await expect(page.locator("#operationsMessage")).toContainText(
    "preferences saved",
  );
  await page.locator('#reportFilters input[name="projectId"]').fill(p.id);
  await page
    .getByRole("button", { name: "Filter report", exact: true })
    .click();
  await expect(page.locator("#projectReport")).toContainText(
    "Inbox fixture " + info.project.name,
  );
  await expect(page.locator("#reportFreshness")).toContainText(
    "Deployment status: unconfigured",
  );
  await page.reload();
  await page.locator("#projectOperations summary").click();
  await expect(
    page.locator('#notificationPreferences input[name="delivery"]'),
  ).not.toBeChecked();
});
