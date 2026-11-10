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
  await expect(page.locator("#workspaceSidebar")).toHaveCount(0);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.locator("#workspaceNavigation")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const form = page.locator("#createProjectForm");
  await form
    .getByLabel("Project key")
    .fill("E2E-" + testInfo.project.name.toUpperCase() + "-" + testInfo.retry);
  await form
    .getByLabel("Project name", { exact: true })
    .fill("Verified delivery " + testInfo.project.name);
  await form.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(form.locator(".project-create-progress")).toContainText("Organization and applications");
  await form.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(form.locator(".project-create-progress")).toContainText("Review and create");
  await form
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(page.locator("#projectCreateSuccess")).toBeVisible();
  await expect(page.locator("#projectCreateSuccessDescription")).toContainText("E2E-");
  await page.getByRole("link",{name:"View Project",exact:true}).click();
  await expect(page).toHaveURL(/\/projects\/E2E-[A-Z0-9-]+\?view=team$/);
  const url = page.url();
  const projectPath=new URL(url).pathname;
  const projectKey=projectPath.split("/").at(-1);
  const resolved=await context.request.get("/api/projects/by-key/"+encodeURIComponent(projectKey));
  expect(resolved.status()).toBe(200);
  const projectId=(await resolved.json()).project.id;
  const workforceResponse=await context.request.get("/api/projects/"+projectId+"/workforce");
  expect(workforceResponse.status(),JSON.stringify(await workforceResponse.json())).toBe(200);
  await expect(page.locator("#projectMessage")).toBeEmpty({timeout:8000});
  await page.locator('[data-project-view="applications"]').click();
  await expect(page.locator("#newCustomApplication")).toBeVisible({timeout:10000});
  await page.getByRole("button", {name:"New custom application"}).click();
  const application = page.locator("#customApplicationForm");
  await application.getByLabel("Application name").fill("Guest services portal");
  await application.getByLabel("Lifecycle").selectOption("building");
  await application.getByLabel("Description").fill("Custom application built for this project");
  await application.getByLabel("Git repository HTTPS URL (optional)").fill("https://github.com/example/guest-portal");
  await application.getByRole("button",{name:"Save application",exact:true}).click();
  await expect(page.locator("#customApplicationList")).toContainText("Guest services portal");
  const customResponse = await context.request.get("/api/projects/" + projectId + "/applications");
  expect(customResponse.status()).toBe(200);
  const apps = await customResponse.json();
  expect(apps.applications).toHaveLength(1);
  expect(apps.applications[0].name).toBe("Guest services portal");
  await expect(page.locator("#projectTitle")).toContainText(
    "Verified delivery",
  );
  await page.locator('[data-project-view="team"]').click();
  await page.locator("#teamEditor summary").click();
  const member=page.locator("#memberForm");
  const staff=member.getByLabel("Employee",{exact:true});
  await expect(staff).toContainText("staff "+testInfo.project.name);
  const option=staff.locator("option").filter({hasText:"staff "+testInfo.project.name}).first();
  const staffId=await option.getAttribute("value");
  await staff.selectOption(staffId);
  await member.getByLabel("Team",{exact:true}).fill("Engineering");
  await member.getByRole("button",{name:"Save project assignment"}).click();
  await page.locator(".vsph-ui-dialog").getByRole("button",{name:"Confirm change"}).click();
  await expect(page.locator("#teamList")).toContainText("Engineering");
  await page.locator('[data-project-view="milestones"]').click();
  await page.locator("#milestoneEditor summary").click();
  let mf = page.locator("#milestoneForm");
  await mf.getByLabel("Milestone title").fill("Staging acceptance");
  await mf
    .getByRole("button", { name: "Create milestone", exact: true })
    .click();
  await expect(page.locator("#milestoneList")).toContainText(
    "Staging acceptance",
  );
  await page.locator('[data-project-view="tasks"]').click();
  await page.locator("#taskEditor summary").click();
  let tf = page.locator("#taskForm");
  await tf.getByLabel("Task title").fill("Implement tested flow");
  await tf
    .getByLabel("Assignee")
    .selectOption(staffId);
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
  await page.locator('[data-project-view="overview"]').click();
  await expect(page.locator("#projectSummary")).toContainText("100%");
  await expect(page.locator("#projectDetail")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator('[data-project-view="delivery"]').click();
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
  await page.locator('[data-project-view="tasks"]').click();
  await expect(page.locator("#taskList")).toContainText(
    "Implement tested flow",
  );
  await page.locator('[data-project-view="activity"]').click();
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
    "/api/projects/" + projectId,
  );
  expect(denied.status()).toBe(403);
  const applicationsDenied = await context.request.get("/api/projects/" + projectId + "/applications");
  expect(applicationsDenied.status()).toBe(403);
  const keyDenied = await context.request.get("/api/projects/by-key/" + encodeURIComponent(projectKey));
  expect(keyDenied.status()).toBe(403);
  await page.goto(projectPath + "?verify=outsider");
  await expect(page.locator("#projectMessage")).toContainText("Access denied");
  await expect(page.locator("#projectTitle")).not.toContainText(
    "Verified delivery",
  );
});


test("workforce dependency failure does not hide the existing project workspace", async ({
  page,
  context,
}, info) => {
  test.skip(
    !process.env.PROJECT_E2E_DATABASE,
    "Requires isolated PostgreSQL fixture server.",
  );
  await context.setExtraHTTPHeaders({ Origin: "http://127.0.0.1:3100" });
  await context.addCookies([
    {
      name: "vsph.portal.sid",
      value: "fixture-admin-session",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const created = await context.request.post("/api/projects", {
    data: {
      key: "WFFAIL-" + info.project.name.toUpperCase() + "-" + info.retry,
      name: "Independent project workspace " + info.project.name,
      kind: "internal",
    },
  });
  expect(created.status()).toBe(201);
  const project = await created.json();
  await page.route("**/api/projects/" + project.id + "/workforce", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Workforce schema unavailable." }),
    }),
  );
  await page.goto("/projects/" + project.id);
  await expect(page.locator("#projectTitle")).toContainText("Independent project workspace");
  await page.locator('[data-project-view="team"]').click();
  await expect(page.locator("#workforceSummary")).toContainText(
    "Employee assignments unavailable: Workforce schema unavailable.",
  );
  await expect(page.locator("#addProjectMember")).toBeHidden();
  await page.locator('[data-project-view="applications"]').click();
  await expect(page.locator("#newCustomApplication")).toBeVisible();
  await expect(page.locator("#projectDetail")).toHaveAttribute("aria-busy", "false");
});
