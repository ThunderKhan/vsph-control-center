const { test, expect } = require("@playwright/test");
test("authenticated project delivery workflow persists and denies an outsider", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  test.skip(
    !process.env.PROJECT_E2E_DATABASE,
    "Requires isolated PostgreSQL fixture server.",
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
  await page.goto("/projects");
  if (testInfo.project.name === "desktop") {
    await page
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );
    await page
      .getByRole("button", { name: "Expand sidebar", exact: true })
      .click();
  } else {
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await expect(page.locator("body")).toHaveClass(/nav-open/);
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
  }
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const form = page.locator("#createProjectForm");
  await form
    .getByLabel("Project key")
    .fill("E2E-" + testInfo.project.name.toUpperCase() + "-" + testInfo.retry);
  await form
    .getByLabel("Project name", { exact: true })
    .fill("Verified delivery " + testInfo.project.name);
  await form
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  const url = page.url();
  await expect(page.locator("#projectTitle")).toContainText(
    "Verified delivery",
  );
  await page.locator("#teamEditor summary").click();
  const member = page.locator("#memberForm");
  await member
    .getByLabel("Find an existing account")
    .fill("developer@fixture.test");
  await member
    .getByRole("button", { name: "Find account", exact: true })
    .click();
  await expect(member.getByLabel("Project member")).toContainText(
    "Fixture Developer",
  );
  await member
    .getByLabel("Project member")
    .selectOption("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await member.getByLabel("Development team").fill("Engineering");
  await member.getByRole("button", { name: "Save project membership" }).click();
  await expect(page.locator("#teamList")).toContainText("Engineering");
  await page.locator("#milestoneEditor summary").click();
  let mf = page.locator("#milestoneForm");
  await mf.getByLabel("Milestone title").fill("Staging acceptance");
  await mf
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await expect(page.locator("#milestoneList")).toContainText(
    "Staging acceptance",
  );
  await page.locator("#taskEditor summary").click();
  let tf = page.locator("#taskForm");
  await tf.getByLabel("Task title").fill("Implement tested flow");
  await tf
    .getByLabel("Assignee")
    .selectOption("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await tf
    .getByLabel("Milestone", { exact: true })
    .selectOption({ label: "Staging acceptance" });
  await tf.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.locator("#taskList")).toContainText(
    "Implement tested flow",
  );
  for (const state of ["in_progress", "in_review", "done"]) {
    await page
      .getByLabel("Status for Implement tested flow")
      .selectOption(state);
    await expect(page.locator("#projectMessage")).toHaveText("Saved.");
    await expect(
      page.getByLabel("Status for Implement tested flow"),
    ).toHaveValue(state);
  }
  await expect(page.locator("#projectSummary")).toContainText("100%");
  await expect(page.locator("#projectDetail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const comment = page.locator("#commentForm");
  await comment
    .getByLabel("Comment", { exact: true })
    .fill("Acceptance evidence recorded");
  await comment
    .getByRole("button", { name: "Add comment", exact: true })
    .click();
  await expect(page.locator("#commentList")).toContainText(
    "Acceptance evidence recorded",
  );
  const df = page.locator("#deliverableForm");
  await df.getByLabel("Deliverable title").fill("Build evidence");
  await df.getByLabel("HTTPS evidence link").fill("https://example.test/build");
  await df
    .getByRole("button", { name: "Add deliverable", exact: true })
    .click();
  await expect(page.locator("#deliverableList")).toContainText(
    "Build evidence",
  );
  await page.reload();
  await expect(page.locator("#taskList")).toContainText(
    "Implement tested flow",
  );
  await expect(
    page.locator('#activityList [data-action="task.update"]').first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  const screenshot = testInfo.outputPath("projects.jpg");
  await page.screenshot({
    path: screenshot,
    type: "jpeg",
    quality: 75,
    fullPage: false,
  });
  await testInfo.attach("Authenticated project fixture", {
    path: screenshot,
    contentType: "image/jpeg",
  });
  await context.clearCookies();
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-outsider-session",
      url: "http://127.0.0.1:3100",
    },
  ]);
  const denied = await context.request.get(
    "/api/projects/" + url.split("/").at(-1),
  );
  expect(denied.status()).toBe(403);
  await page.goto(url);
  await expect(page.locator("#projectMessage")).toContainText("Access denied");
  await expect(page.locator("#projectTitle")).not.toContainText(
    "Verified delivery",
  );
});
