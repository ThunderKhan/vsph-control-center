const {test,expect}=require('@playwright/test');
test('protected employee, customer and finance pages show one top navigation and no duplicate page navigation',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database and simulated portal session');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',
  url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 for(const [route,heading] of [
  ['/employees/onboarding','Onboard an employee'],
  ['/admin/onboarding','Onboard a customer'],
  ['/admin/finance','Financial overview'],
  ['/employees','Employee management']
 ]){
  await page.goto(route);
  await expect(page.locator('#workspaceNavigation')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:heading,exact:false})).toBeVisible();
  await expect(page.locator('.people-nav,.finance-nav,.onboarding-header')).toHaveCount(0);
  await expect(page.getByRole('link',{name:/^Back to (employees|administration|overview)$/i})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' horizontal overflow').toBe(true);
 }
 const sizing=await page.goto('/employees/onboarding').then(()=>page.evaluate(()=>{
  const aside=document.querySelector('.people-steps'),panel=document.querySelector('.people-wizard-panel');
  return {sidebar:aside.getBoundingClientRect().height,panel:panel.getBoundingClientRect().height,width:innerWidth};
 }));
 expect(sizing.sidebar).toBeLessThan(390);
 expect(sizing.panel).toBeLessThan(sizing.width<760?540:450);
 await info.attach('clean-employee-onboarding-'+info.project.name,{
  body:await page.screenshot({fullPage:true}),contentType:'image/png'
 });
});
