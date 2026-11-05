const {test,expect}=require('@playwright/test');
test('CRM-adapted shell has working scoped search, profile navigation and preserved operating dashboard',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 await page.goto('/dashboard');await expect(page.locator('#ownerHeroTitle')).toBeVisible();await expect(page.locator('.crm-topbar')).toBeVisible();
 await page.getByLabel('Search authorized work',{exact:true}).fill('Assigned delivery');await page.getByRole('button',{name:'Run workspace search'}).click();await expect(page.locator('#workspaceSearchItems li').first()).toBeVisible();await page.getByLabel('Search authorized work',{exact:true}).press('Escape');
 await page.route('**/api/search?**',route=>route.fulfill({status:200,json:{results:[{project_id:'11111111-1111-4111-a111-111111111111',title:'<img src=x onerror=alert(1)>',kind:'task',project_name:'Authorized project'}]}}));
 await page.getByLabel('Search authorized work',{exact:true}).fill('Assigned');await page.getByRole('button',{name:'Run workspace search'}).click();
 await expect(page.locator('#workspaceSearchItems')).toContainText('<img src=x');await expect(page.locator('#workspaceSearchItems img')).toHaveCount(0);expect(new URL(page.url()).search).toBe('');
 await page.getByLabel('Search authorized work',{exact:true}).press('Escape');await expect(page.locator('#workspaceSearchResults')).toBeHidden();
 await page.unroute('**/api/search?**');await page.locator('.portal-account>summary[aria-label="Account menu"]').click();await page.getByRole('link',{name:'Open account profile',exact:true}).click();await expect(page).toHaveURL(/\/account\/profile$/);await expect(page.locator('#profileForm')).toBeVisible();
 const eyebrow=await page.locator('.account-page>header p').first().boundingBox(),heading=await page.locator('.account-page>header h1').boundingBox();expect(Math.abs(eyebrow.x-heading.x)).toBeLessThan(1);expect(heading.y).toBeGreaterThanOrEqual(eyebrow.y+eyebrow.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('crm-workspace-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await context.clearCookies();await page.goto('/login');await expect(page.locator('#authForm')).toBeVisible();await expect(page.locator('#authDots')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if(info.project.name==='mobile')expect((await page.locator('.auth-card').boundingBox()).y).toBeLessThan(120);
 await info.attach('crm-login-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});
