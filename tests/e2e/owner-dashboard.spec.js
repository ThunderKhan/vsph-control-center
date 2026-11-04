const {test,expect}=require('@playwright/test');
const cookie=value=>({name:'vsph.portal.sid',value,url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'});
test('full owner dashboard shows durable operating records and survives finance failure',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 await context.addCookies([cookie('fixture-admin-session')]);
 const response=await context.request.get('/api/admin-management/dashboard');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
 const report=await response.json();expect(['ready','unavailable']).toContain(report.customers.status);expect(['ready','unavailable']).toContain(report.delivery.status);
 expect((await context.request.get('/api/admin-management/dashboard?tenant=other')).status()).toBe(400);
 await page.route('**/api/finance/overview',r=>r.fulfill({status:503,json:{code:'SCHEMA_NOT_READY'}}));
 // Other authenticated suites mutate the shared isolated fixture concurrently.
 // Compare with this page's response, not the earlier independent API read.
 const loaded=page.waitForResponse(r=>r.url().endsWith('/api/admin-management/dashboard'));
 await page.goto('/dashboard');const displayed=await (await loaded).json();
 await expect(page.getByRole('heading',{name:'Company overview'})).toBeVisible();
 await expect(page.locator('#ownerOperationsStatus')).toHaveText(/Operating records loaded|Some operating sections are unavailable/);
 await expect(page.locator('#ownerActiveCustomers')).toHaveText(displayed.customers.status==='ready'?displayed.customers.active.toLocaleString('en-IN'):'—');
 await expect(page.locator('#ownerOverviewStatus')).toContainText('database upgrade is required');
 await expect(page.locator('#ownerOverviewFacts')).toBeHidden();await expect(page.locator('.owner-operations')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('owner-restored-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.unroute('**/api/finance/overview');await page.reload();
 await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
 await expect(page.locator('#ownerOperationsStatus')).toHaveText(/Operating records loaded|Some operating sections are unavailable/);
 await page.route('**/api/admin-management/dashboard',r=>r.fulfill({status:503,json:{message:'unavailable'}}));
 await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerOperationsStatus')).toContainText('Operating records are unavailable');
 await expect(page.locator('#ownerActiveCustomers')).toHaveText('—');await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
 await context.clearCookies();expect((await context.request.get('/api/admin-management/dashboard')).status()).toBe(401);
 await context.addCookies([cookie('fixture-outsider-session')]);expect((await context.request.get('/api/admin-management/dashboard')).status()).toBe(403);
});
