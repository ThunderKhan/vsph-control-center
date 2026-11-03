const { test, expect } = require("@playwright/test");
test("project inbox preferences and reports persist with scoped assignments", async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.PROJECT_E2E_DATABASE, "Requires isolated database");
  const label = info.project.name + " retry " + info.retry;
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
      key: "INBOX-" + info.project.name.toUpperCase() + "-" + info.retry,
      name: "Inbox fixture " + label,
      kind: "internal",
    },
  });
  const p = await r.json();
  expect(
    (
      await context.request.post("/api/projects/" + p.id + "/tasks", {
        data: {
          version: 1,
          title: "Assignment notification " + label,
          assigneeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/projects");
  await page.locator("#projectOperations summary").click();
  await expect(page.locator("#notificationList")).toContainText(
    "Assignment notification " + label,
    { timeout: 15000 }, // Above the API's 12-second deadline; still requires real delivery.
  );
  const notice = page
    .locator("#notificationList li")
    .filter({ hasText: "Assignment notification " + label });
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
    "Inbox fixture " + label,
  );
  await expect(page.locator("#reportFreshness")).toContainText(
    "Deployment status: unconfigured",
  );
  await expect(page.locator('#exportProjectReport')).toHaveAttribute('href','/api/project-reports/export.csv?projectId='+p.id);
  const downloadPromise=page.waitForEvent('download');await page.locator('#exportProjectReport').click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('vsph-project-report.csv');
  const csv=await require('node:fs/promises').readFile(await download.path(),'utf8');
  expect(csv).toContain('Inbox fixture '+info.project.name);expect(csv).toContain('First 100 authorized matching projects');expect(csv).toContain('unconfigured');
  await info.attach('project-report-'+info.project.name+'-isolated-fixture',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.reload();
  await page.locator("#projectOperations summary").click();
  await expect(
    page.locator('#notificationPreferences input[name="delivery"]'),
  ).not.toBeChecked();
});

test('initial inbox outage can recover through Refresh without losing authorized reports or saving unread preferences',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 await page.route('**/api/notifications',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic inbox unavailable'})}));
 await page.goto('/projects');await page.locator('#projectOperations summary').click();
 await expect(page.locator('#operationsMessage')).toHaveText('Synthetic inbox unavailable');
 await expect(page.getByRole('button',{name:'Save notification preferences',exact:true})).toBeDisabled();
 await expect(page.locator('#notificationList')).toBeEmpty();await expect(page.locator('#notificationList')).toHaveAttribute('aria-busy','false');
 await page.unroute('**/api/notifications');await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();
 await expect(page.locator('#operationsMessage')).toHaveText('Inbox refreshed.');
 await expect(page.getByRole('button',{name:'Save notification preferences',exact:true})).toBeEnabled();
 await expect(page.locator('#reportFreshness')).toContainText('Generated');
 await expect(page.locator('#notificationList li').first()).toBeVisible();
 // A later failure removes stale inbox records and leaves recovery available.
 await page.route('**/api/notifications',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic later outage'})}));
 await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();await expect(page.locator('#operationsMessage')).toHaveText('Synthetic later outage');await expect(page.locator('#notificationList')).toBeEmpty();
 await page.unroute('**/api/notifications');await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();await expect(page.locator('#operationsMessage')).toHaveText('Inbox refreshed.');
});
