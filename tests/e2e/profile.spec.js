const {test,expect}=require('@playwright/test');
test('a member customizes only their own durable profile without gaining workforce access',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-profile-'+info.project.name,url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 const api='/api/account/profile';expect((await context.request.get(api+'?userId=someone-else')).status()).toBe(400);
 const before=await (await context.request.get(api)).json();
 expect((await context.request.patch(api,{headers:{Origin:'http://127.0.0.1:3100'},data:{displayName:'x',bio:'',timeZone:'UTC',avatarTone:'blue',version:before.version,platformRole:'super_admin'}})).status()).toBe(400);
 await page.goto('/account/profile');await expect(page.locator('#profileContent')).toBeVisible();
 await page.getByLabel('Display name',{exact:true}).fill('Personal '+info.project.name);
 await page.getByLabel('About you',{exact:true}).fill('Software development\nMy own profile');await page.getByLabel('Time zone',{exact:true}).fill('Asia/Kolkata');await page.getByLabel('Blue',{exact:true}).check();
 await page.getByRole('button',{name:'Save Profile',exact:true}).click();await expect(page.locator('#profileMessage')).toHaveText('Profile saved.');
 await page.reload();await expect(page.locator('#profilePreviewName')).toHaveText('Personal '+info.project.name);await expect(page.locator('#profileAvatar')).toHaveAttribute('data-tone','blue');await expect(page.locator('#profileRole')).toHaveText('Portal member');
 expect((await context.request.get('/api/employees')).status()).toBe(403);expect((await context.request.get('/api/admin-management/dashboard')).status()).toBe(403);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('personal-profile-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.goto('/dashboard');await page.locator('.portal-account>summary[aria-label="Account menu"]').click();await page.getByRole('link',{name:'Open account profile',exact:true}).click();await expect(page).toHaveURL(/\/account\/profile$/);
});
