const {test,expect}=require('@playwright/test');
const origin='http://127.0.0.1:3100';
async function login(context,token){await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);}
test('shared navigation survives module changes and repeated desktop/mobile toggles',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL');test.setTimeout(90000);await login(context,'fixture-admin-session');
 for(const path of ['/dashboard','/projects','/admin/customers','/admin/products','/admin/provisioning','/admin/finance','/admin/finance/journal','/employees','/employees/onboarding','/hr','/hr/access','/account/profile','/admin/onboarding','/organizations','/search']){
  await page.goto(path);await expect(page.locator('#workspaceSidebar')).toHaveCount(1);await expect(page.locator('main > nav[aria-label="Workspace"]')).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('data-navigation-ready','true');
  if(info.project.name==='mobile'){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.locator('#workspaceSidebar')).toBeVisible();await expect(page.locator('.workspace-main')).toHaveJSProperty('inert',true);await page.keyboard.press('Escape');await expect(page.locator('#openMenu')).toBeFocused();}
  else{await expect(page.locator('#workspaceSidebar .sidebar-link[href="/hr/access"]')).toBeVisible();for(let n=0;n<3;n++)await page.locator('#sidebarToggle').click();const state=await page.locator('html').getAttribute('data-sidebar-state');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-sidebar-state',state);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true);
 }
 await info.attach('shared-sidebar-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});
test('HR, employees and Music customers receive distinct menus with enforced server denials',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL');
 for(const [token,path,hr,own] of [['fixture-hrms-hr-'+info.project.name,'/hr',true,true],['fixture-hrms-staff-'+info.project.name,'/my-work',false,true],['fixture-music-customer-session','/applications',false,false]]){
  await login(context,token);await page.goto(path);await expect(page.locator('html')).toHaveAttribute('data-navigation-ready','true');
  expect(await page.locator('#employeeNavContainer').evaluate(e=>e.hidden)).toBe(!hr);expect(await page.locator('#myWorkNav').evaluate(e=>e.hidden)).toBe(!own);expect(await page.locator('#adminNavContainer').evaluate(e=>e.hidden)).toBe(true);expect(await page.locator('#hrGovernanceNav').evaluate(e=>e.hidden)).toBe(true);
  expect((await context.request.get('/hr/access')).status()).toBe(403);expect((await context.request.get('/admin')).status()).toBe(403);
 }
 await expect(page.locator('#appGrid .app-card')).toHaveCount(1);await expect(page.locator('#appGrid')).toContainText('Music');expect((await context.request.get('/hr')).status()).toBe(403);expect((await context.request.get('/my-work')).status()).toBe(403);expect((await context.request.get('/apps/crm/login')).status()).toBe(403);
});
