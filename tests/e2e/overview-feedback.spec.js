const {test,expect}=require('@playwright/test');
const origin='http://127.0.0.1:3100';
const cookie=token=>({name:'vsph.portal.sid',value:token,url:origin,httpOnly:true,sameSite:'Lax'});

test('linked employees can reach the activity heatmap from Overview; customers cannot',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 await context.addCookies([cookie('fixture-hrms-staff-'+info.project.name)]);
 await page.goto('/dashboard');
 await expect(page.locator('.crm-avatar-status')).toHaveCount(1);
 await expect(page.locator('.overview-help')).toHaveCount(0);
 await expect(page.getByText('Account active',{exact:true})).toHaveCount(0);
 await expect(page.locator('#overviewDetails')).toBeHidden();
 const shortcut=page.locator('#myWorkShortcut');
 await expect(shortcut).toBeVisible();
 await shortcut.click();
 await expect(page).toHaveURL(/\/my-work$/);
 await expect(page.locator('#workActivity[data-state="loaded"]')).toBeVisible();
 await expect(page.locator('.work-activity-heading')).toContainText('recorded task completion');

 await context.clearCookies();
 await context.addCookies([cookie('fixture-music-customer-session')]);
 await page.goto('/dashboard');
 await expect(page.locator('#myWorkShortcut')).toBeHidden();
 await expect(page.locator('.crm-avatar-status')).toHaveCount(1);
 expect((await context.request.get('/my-work')).status()).toBe(403);
});
