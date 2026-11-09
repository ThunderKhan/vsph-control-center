const {test,expect}=require('@playwright/test');
const crypto=require('node:crypto');
const origin='http://127.0.0.1:3100';
const slugFor=(prefix,info)=>prefix+'-'+info.project.name+'-'+crypto.randomBytes(4).toString('hex');
async function owner(page,context){
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:origin,httpOnly:true,sameSite:'Lax'}]);
 await page.goto('/admin/onboarding');
}
async function identity(page,slug,email){
 await page.locator('#orgName').fill(slug);
 await page.locator('#nextButton').click();
 await expect(page.locator('#stepIndicator')).toHaveText('STEP 2 OF 4');
 await page.locator('#adminName').fill('Verified Client Owner');
 await page.locator('#adminEmail').fill(email);
 await page.locator('#nextButton').click();
 await expect(page.locator('#stepIndicator')).toHaveText('STEP 3 OF 4');
}
test('catalog onboarding queues one owner invitation and creates explicit product access',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database fixtures.');
 await owner(page,context);
 const slug=slugFor('catalog-owner',info),email=slug+'@fixture.test';
 await identity(page,slug,email);
 await page.locator('#catalogMode').check();
 await expect(page.locator('#productChoices input').first()).toBeVisible();
 await page.locator('#productChoices input').first().check();
 await expect(page.locator('#subscriptionCards')).toContainText('Plan code');
 await page.locator('#nextButton').click();
 await expect(page.locator('#stepIndicator')).toHaveText('STEP 4 OF 4');
 await expect(page.locator('#reviewDetails')).toContainText('trial');
 await page.locator('#confirm').check();
 await page.locator('#nextButton').click();
 await expect(page.locator('#completeScreen')).toBeVisible();
 await expect(page.locator('#createdProducts')).toContainText('1 catalog product');
 await expect(page.locator('#completeMessage')).toContainText('queued');
 const jobs=await (await context.request.get('/api/admin-management/onboardings')).json();
 expect(jobs.some(j=>j.email===email&&j.state==='queued')).toBe(true);
 await page.goto('/admin/provisioning');
 await expect(page.locator('#jobs')).toContainText(email);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('organization-first default creates a client and owner invitation without product entitlements',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database fixtures.');
 await owner(page,context);
 const slug=slugFor('custom-owner',info),email=slug+'@fixture.test';
 await identity(page,slug,email);
 await expect(page.locator('#customOnly')).toBeChecked();
 await expect(page.locator('#catalogConfiguration')).toBeHidden();
 await page.locator('#nextButton').click();
 await expect(page.locator('#reviewDetails')).toContainText('no catalog subscription or product grant');
 await page.locator('#confirm').check();
 await page.locator('#nextButton').click();
 await expect(page.locator('#completeScreen')).toBeVisible();
 await expect(page.locator('#createdProducts')).toHaveText('None');
 await expect(page.locator('#createdWorkspace')).toHaveText(slug);
 await expect(page.locator('#completeProject')).toHaveAttribute('href',/\/projects\?organizationId=[0-9a-f-]+/);
 await expect(page.locator('#completeDirectory')).toHaveAttribute('href',/\/admin\/customers\?organization=[0-9a-f-]+/);
 const jobs=await (await context.request.get('/api/admin-management/onboardings')).json();
 expect(jobs.filter(j=>j.email===email&&j.state==='queued')).toHaveLength(1);
});
test('review edit retains form data and resets confirmation',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database fixtures.');
 await owner(page,context);
 const slug=slugFor('review-owner',info);
 await identity(page,slug,slug+'@fixture.test');
 await page.locator('#nextButton').click();
 await page.locator('#confirm').check();
 await page.getByRole('button',{name:'Edit customer owner'}).click();
 await expect(page.locator('[data-panel="1"] legend')).toBeFocused();
 await page.locator('#adminEmail').fill('edited-'+slug+'@fixture.test');
 await page.locator('#nextButton').click();
 await expect(page.locator('#stepIndicator')).toHaveText('STEP 3 OF 4');
 await page.locator('#nextButton').click();
 await expect(page.locator('#confirm')).not.toBeChecked();
 await expect(page.locator('#reviewDetails')).toContainText('edited-'+slug+'@fixture.test');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('taken workspace identifiers are blocked before creating another organization',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database fixtures.');
 await owner(page,context);
 const slug=slugFor('taken-owner',info);
 const result=await context.request.post('/api/admin-management/onboardings',{
  headers:{Origin:origin,'Idempotency-Key':crypto.randomUUID()},
  data:{organizationName:'Existing customer',slug,adminName:'Existing Owner',adminEmail:slug+'@fixture.test',products:[]}
 });
 expect(result.status()).toBe(202);
 await page.locator('#orgName').fill('Another customer');
 await page.locator('#orgSlug').fill(slug);
 await page.locator('#orgSlug').blur();
 await expect(page.locator('#slugStatus')).toContainText('already taken');
 await page.locator('#nextButton').click();
 await expect(page.locator('#stepIndicator')).toHaveText('STEP 1 OF 4');
 await expect(page.locator('#wizardError')).toContainText('identifier');
});
test('lost creation response recovers the original durable job, without duplicating the tenant',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database fixtures.');
 await owner(page,context);
 const slug=slugFor('recovered-owner',info),email=slug+'@fixture.test';
 await identity(page,slug,email);
 await page.locator('#nextButton').click();
 await page.locator('#confirm').check();
 let intercepted=0;
 await page.route('**/api/admin-management/onboardings',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  intercepted++;
  const result=await route.fetch();
  expect(result.status()).toBe(202);
  await route.abort('failed');
 });
 await page.locator('#nextButton').click();
 await expect(page.locator('#completeScreen')).toBeVisible();
 await expect(page.locator('#createdWorkspace')).toHaveText(slug);
 expect(intercepted).toBe(1);
 const jobs=await (await context.request.get('/api/admin-management/onboardings')).json();
 expect(jobs.filter(j=>j.email===email)).toHaveLength(1);
});
test('legacy orphan organization creation is retired and customer sessions cannot onboard clients',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database fixtures.');
 await owner(page,context);
 const legacy=await context.request.post('/api/admin-management/organizations',{
  headers:{Origin:origin},data:{name:'Orphan',slug:'never-create-orphan'}
 });
 expect(legacy.status()).toBe(410);
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-outsider-session',url:origin}]);
 expect((await context.request.get('/admin/onboarding')).status()).toBe(403);
 expect((await context.request.get('/api/admin-management/onboardings/availability?slug=private-org')).status()).toBe(403);
 expect((await context.request.get('/api/admin-management/onboardings/requests/'+crypto.randomUUID())).status()).toBe(403);
});
