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
  await page.goto("/notifications");
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
    .getByRole("button", { name: "Save Notification Preferences", exact: true })
    .click();
  await expect(page.locator("#operationsMessage")).toContainText(
    "preferences saved",
  );
  await page.goto('/reports');
  await page.locator('#reportFilters input[name="projectId"]').fill(p.id);
  await page
    .getByRole("button", { name: "Filter Report", exact: true })
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
  await page.goto("/notifications");
  await expect(
    page.locator('#notificationPreferences input[name="delivery"]'),
  ).not.toBeChecked();
});

test('initial inbox outage can recover through Refresh without losing authorized reports or saving unread preferences',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 await page.route('**/api/notifications',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic inbox unavailable'})}));
 await page.goto('/notifications');
 await expect(page.locator('#operationsMessage')).toHaveText('Synthetic inbox unavailable');
 await expect(page.getByRole('button',{name:'Save Notification Preferences',exact:true})).toBeDisabled();
 await expect(page.locator('#notificationList')).toBeEmpty();await expect(page.locator('#notificationList')).toHaveAttribute('aria-busy','false');
 await page.unroute('**/api/notifications');await page.getByRole('button',{name:'Refresh Inbox',exact:true}).click();
 await expect(page.locator('#operationsMessage')).toHaveText('Inbox refreshed.');
 await expect(page.getByRole('button',{name:'Save Notification Preferences',exact:true})).toBeEnabled();
 // Reports load independently from notifications and do not affect inbox recovery.
 await expect(page.locator('#notificationList li').first()).toBeVisible();
 // A later failure removes stale inbox records and leaves recovery available.
 await page.route('**/api/notifications',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic later outage'})}));
 await page.getByRole('button',{name:'Refresh Inbox',exact:true}).click();await expect(page.locator('#operationsMessage')).toHaveText('Synthetic later outage');await expect(page.locator('#notificationList')).toBeEmpty();
 await page.unroute('**/api/notifications');await page.getByRole('button',{name:'Refresh Inbox',exact:true}).click();await expect(page.locator('#operationsMessage')).toHaveText('Inbox refreshed.');
});

test('report recovery preserves preference drafts and late inbox replies cannot duplicate or resurrect unread rows',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');
 await context.setExtraHTTPHeaders({Origin:'http://127.0.0.1:3100'});
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 const title='Inbox race '+info.project.name+' '+info.retry;
 const created=await context.request.post('/api/projects',{data:{key:'REC-'+info.project.name.toUpperCase()+'-'+info.retry,name:title,kind:'internal'}});expect(created.status()).toBe(201);const p=await created.json();
 expect((await context.request.post('/api/projects/'+p.id+'/tasks',{data:{version:1,title,assigneeId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}})).status()).toBe(200);
 await page.route('**/api/project-reports**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic report unavailable'})}));
 await page.goto('/reports');
 await expect(page.locator('#operationsMessage')).toHaveText('Synthetic report unavailable');
 await page.unroute('**/api/project-reports**');
 await page.goto('/notifications');
 const preference=page.locator('#notificationPreferences input[name=delivery]');await expect(preference).toBeEnabled();const draft=!(await preference.isChecked());await preference.setChecked(draft);
 await page.getByRole('button',{name:'Refresh Inbox',exact:true}).click();await expect(page.locator('#operationsMessage')).toHaveText('Inbox refreshed.');await expect(preference).toBeChecked({checked:draft});
 const oldData=await (await context.request.get('/api/notifications')).json();
 let release,seen;const held=new Promise(resolve=>{release=resolve;}),firstRequest=new Promise(resolve=>{seen=resolve;});let calls=0;
 await page.route('**/api/notifications',async route=>{
  if(++calls===1){seen();await held;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(oldData)});}
  else await route.continue();
 });
 const row=page.locator('#notificationList li').filter({hasText:title});await row.getByRole('button',{name:'Mark read',exact:true}).click();await firstRequest;
 await page.getByRole('button',{name:'Refresh Inbox',exact:true}).click();await expect(page.locator('#operationsMessage')).toHaveText('Inbox refreshed.');
 await expect(page.locator('#notificationList li').filter({hasText:title})).toContainText('Read');
 await expect(page.locator('#notificationList li').filter({hasText:title}).getByRole('button',{name:'Mark read',exact:true})).toHaveCount(0);
 const count=await page.locator('#notificationList li').count();const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications');release();await (await response).finished();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(page.locator('#notificationList li')).toHaveCount(count);await expect(page.locator('#notificationList li').filter({hasText:title})).toHaveCount(1);
 await expect(page.locator('#notificationList li').filter({hasText:title}).getByRole('button',{name:'Mark read',exact:true})).toHaveCount(0);
});
