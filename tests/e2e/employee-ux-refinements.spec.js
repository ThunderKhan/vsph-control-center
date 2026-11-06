const {test,expect}=require('@playwright/test');
const origin='http://127.0.0.1:3100';
async function signIn(context,session){
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:session,url:origin,httpOnly:true,sameSite:'Lax'}]);
}
test('employee Manage menu, full-width allocation and rounded account trigger work on desktop and mobile',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');
 await signIn(context,'fixture-admin-session');
 await page.goto('/employees');
 await expect(page.locator('#peopleAccessTitle,#hrGovernance,#removedEmployeeHistory')).toHaveCount(0);
 const dept=await page.locator('#departmentChart').boundingBox();
 const container=await page.locator('.people-overview').boundingBox();
 expect(dept.width).toBeGreaterThan(container.width*.65);
 const trigger=page.locator('#employeeRows .people-manage-trigger').first();
 await expect(trigger).toBeVisible();
 await trigger.click();
 await expect(page.getByRole('menuitem',{name:'Edit employee'})).toBeVisible();
 await expect(page.getByRole('menuitem',{name:/Account & access|Review HR access/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('menu')).toHaveCount(0);
 await expect(trigger).toBeFocused();
 await page.locator('.portal-account>summary').click();
 const radius=await page.locator('.portal-account>summary').evaluate(e=>getComputedStyle(e).borderRadius);
 expect(radius).toContain('999px');
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
 if(info.project.name==='desktop'){
  await page.goto('/admin?tab=permissions');
  await expect(page.locator('#section-permissions')).toBeVisible();
  await expect(page.locator('#workforceRoles')).toContainText('Manage access');
  await page.goto('/admin?tab=audit&view=removals');
  await expect(page.locator('#auditRemovalsView')).toBeVisible();
 }
});
test('HR cannot enter owner roles or audit pages',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');
 await signIn(context,'fixture-hrms-hr-'+info.project.name);
 await page.goto('/employees');
 await expect(page.locator('#removedEmployeeHistory,#hrGovernance')).toHaveCount(0);
 const result=await context.request.get('/api/employees/removals');
 expect(result.status()).toBe(403);
 expect((await context.request.get('/admin?tab=audit&view=removals')).status()).toBe(403);
 expect((await context.request.get('/admin?tab=permissions')).status()).toBe(403);
});
