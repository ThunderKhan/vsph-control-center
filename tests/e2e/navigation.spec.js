const {test,expect}=require('@playwright/test');
const origin='http://127.0.0.1:3100';
async function login(context,token){await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);}
test('top navigation spans the full page and survives module changes and keyboard/mobile toggles',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL');test.setTimeout(180000);await login(context,'fixture-admin-session');await page.addInitScript(()=>localStorage.setItem('vsph.sidebar.collapsed','true'));
 for(const path of ['/dashboard','/projects','/admin/customers','/admin/products','/admin/provisioning','/admin/finance','/admin/finance/journal','/employees','/employees/onboarding','/admin/project-managers','/hr','/hr/access','/account/profile','/admin/onboarding','/organizations','/search']){
  await page.goto(path);await expect(page.locator('#workspaceSidebar')).toHaveCount(0);await expect(page.locator('#workspaceNavigation')).toHaveCount(1);await expect(page.locator('main > nav[aria-label="Workspace"]')).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('data-navigation-ready','true');
  expect((await page.locator('.workspace-main').boundingBox()).x).toBe(0);
  expect(await page.locator('html').getAttribute('data-sidebar-state')).toBeNull();
  if(info.project.name==='mobile'){
   for(let n=0;n<2;n++){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.locator('#workspaceNavigation')).toBeVisible();expect((await page.locator('#workspaceNavigation').boundingBox()).y).toBeGreaterThanOrEqual((await page.locator('.crm-header-row').boundingBox()).height);await page.keyboard.press('Escape');await expect(page.locator('#openMenu')).toBeFocused();await expect(page.locator('#workspaceNavigation')).toBeHidden();}
  }else{
   const group=page.locator('#organizationNavigation');await group.locator('summary').click();await expect(group.getByRole('link',{name:'Customer directory',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(group.locator('summary')).toBeFocused();
   const people=page.locator('#peopleNavigation');await people.locator('summary').focus();await page.keyboard.press('ArrowDown');await expect(people.getByRole('link',{name:'Employee management',exact:true})).toBeFocused();await page.keyboard.press('Escape');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true);
  const paging={'/admin/customers':['#customer','#firstCustomers'],'/admin/products':['#product','#firstPage'],'/organizations':['#organization','#firstOrganizations']}[path];
  if(paging){const field=await page.locator(paging[0]).boundingBox(),action=await page.locator(paging[1]).boundingBox();expect(action.y-field.y-field.height,path+' selector/action gap').toBeGreaterThanOrEqual(8);}
  const small=await page.locator('#portalContent button:visible').evaluateAll(items=>items.filter(e=>e.getBoundingClientRect().height<43.9).map(e=>e.textContent.trim()));
  expect(small,path+' has undersized button targets').toEqual([]);
  await info.attach('portal-'+path.replaceAll('/','-')+'-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});

 }
 const denied=await page.goto('/apps/music/login');expect(denied.status()).toBe(403);await expect(page.locator('#workspaceSidebar')).toHaveCount(0);await expect(page.locator('#workspaceNavigation')).toHaveCount(1);await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toBeVisible();
 await info.attach('top-navigation-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});
test('HR, employees and Music customers receive distinct menus with enforced server denials',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL');
 for(const [token,path,hr,own] of [['fixture-hrms-hr-'+info.project.name,'/hr',true,true],['fixture-hrms-staff-'+info.project.name,'/my-work',false,true],['fixture-music-customer-session','/applications',false,false]]){
  await login(context,token);await page.goto(path);await expect(page.locator('html')).toHaveAttribute('data-navigation-ready','true');
  expect(await page.locator('#employeeNavContainer').evaluate(e=>e.hidden)).toBe(!hr);expect(await page.locator('#myWorkNav').evaluate(e=>e.hidden)).toBe(!own);expect(await page.locator('#adminNavContainer').evaluate(e=>e.hidden)).toBe(true);expect(await page.locator('#hrGovernanceNav').evaluate(e=>e.hidden)).toBe(true);
  expect((await context.request.get('/hr/access')).status()).toBe(403);expect((await context.request.get('/admin')).status()).toBe(403);
 }
 await expect(page.locator('#appGrid .app-card')).toHaveCount(1);await expect(page.locator('#appGrid')).toContainText('Music');expect((await context.request.get('/hr')).status()).toBe(403);expect((await context.request.get('/my-work')).status()).toBe(403);expect((await context.request.get('/apps/crm/login')).status()).toBe(403);
 await page.goto('/apps/music/login');await expect(page.locator('#workspaceSidebar')).toHaveCount(0);await expect(page.locator('#workspaceNavigation')).toHaveCount(1);await expect(page.locator('#authForm')).toBeVisible();await expect(page.locator('#authSubmit')).toBeEnabled();await expect(page.locator('#email')).toHaveValue('music@fixture.test');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);if(info.project.name==='mobile'){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.locator('#workspaceNavigation')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#openMenu')).toBeFocused();}
 await page.locator('#password').fill('fixture-password-only');await page.locator('#authSubmit').click();await expect(page).toHaveURL(/\/apps\/music\/home$/);await expect(page.locator('#workspaceSidebar')).toHaveCount(0);await expect(page.locator('#workspaceNavigation')).toHaveCount(1);await expect(page.locator('#recordRows tr')).toHaveCount(1);await expect(page.locator('#recordRows')).toContainText('QA Music request');await expect(page.locator('#recordRows')).not.toContainText('Other tenant private request');await expect(page.locator('#tenantName')).toHaveText('QA Music customer organization');

});

test('top dropdown links navigate to real pages and logout revokes a separate session',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL');
 const signed=await context.request.post('/api/auth/login',{headers:{Origin:origin},data:{email:'admin@fixture.test',password:'fixture-password-only'}});expect(signed.status()).toBe(200);
 await page.goto('/dashboard');await expect(page.locator('html')).toHaveAttribute('data-navigation-ready','true');
 if(info.project.name==='mobile')await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.locator('#peopleNavigation>summary').click();await expect(page.getByRole('link',{name:'New employee',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Employee management',exact:true}).click();await expect(page).toHaveURL(/\/employees$/);await page.getByRole('link',{name:/Onboard employee/}).click();await expect(page).toHaveURL(/\/employees\/onboarding$/);
 if(info.project.name==='mobile')await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.locator('#organizationNavigation>summary').click();await page.getByRole('link',{name:'Customer directory',exact:true}).click();await expect(page).toHaveURL(/\/admin\/customers$/);
 await page.locator('.portal-account>summary[aria-label="Account menu"]').click();await page.getByRole('link',{name:'Open account profile',exact:true}).click();await expect(page).toHaveURL(/\/account\/profile$/);
 await page.locator('.portal-account>summary').click();await expect(page.locator('.crm-header-actions>.crm-header-icon#logoutButton')).toHaveCount(0);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login$/);expect((await context.request.get('/api/auth/me')).status()).toBe(401);
});
