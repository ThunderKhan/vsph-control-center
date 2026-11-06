const {test,expect}=require('@playwright/test');
const crypto=require('node:crypto');
const origin='http://127.0.0.1:3100';
async function owner(page,context){
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:origin,httpOnly:true,sameSite:'Lax'}]);
 await page.goto('/employees/onboarding');
}
async function fillWizard(page,email){
 await page.locator('[name=fullName]').fill('Avery Shah');
 await page.locator('[name=email]').fill(email);
 await page.locator('#staffNext').click();
 await page.locator('[name=department]').fill('Engineering');
 await page.locator('[name=jobTitle]').fill('Software Developer');
 await page.locator('[name=employmentType]').selectOption('intern');
 await page.locator('[name=startDate]').fill('2026-11-06');
 await page.locator('#staffNext').click();
}
const emailFor=info=>'redesign-'+info.project.name+'-'+crypto.randomBytes(5).toString('hex')+'@fixture.test';

test('Review edit applies or discards changes, returns focus and requires reconfirmation',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await owner(page,context);
 await fillWizard(page,'edit-review@fixture.test');
 await page.locator('#employeeConfirmed').check();
 await page.getByRole('button',{name:'Edit employee identity'}).click();
 await expect(page.locator('[data-staff-panel="0"] legend')).toBeFocused();
 await expect(page.locator('#staffNext')).toHaveText('Apply changes');
 await expect(page.locator('#staffPrevious')).toHaveText('Discard changes');
 await page.locator('[name=fullName]').fill('Temporary');
 await page.locator('#staffPrevious').click();
 await expect(page.locator('[data-edit-step="0"]')).toBeFocused();
 await expect(page.locator('#employeeReviewIdentity')).toContainText('Avery Shah');
 await expect(page.locator('#employeeConfirmed')).toBeChecked();
 await page.getByRole('button',{name:'Edit employee identity'}).click();
 await page.locator('[name=fullName]').fill('Avery Edited');
 await page.locator('#staffNext').click();
 await expect(page.locator('[data-edit-step="0"]')).toBeFocused();
 await expect(page.locator('#employeeReviewIdentity')).toContainText('Avery Edited');
 await expect(page.locator('#employeeConfirmed')).not.toBeChecked();
 await page.getByRole('button',{name:'Edit employment details'}).click();
 await page.locator('[name=jobTitle]').fill('Senior Developer');
 await page.locator('#staffNext').click();
 await expect(page.locator('#employeeReviewPosition')).toContainText('Senior Developer');
 await expect(page.locator('#employeeReviewIdentity')).toContainText('edit-review@fixture.test');
 await expect(page.locator('#staffNext')).toHaveText('Create employee');
 await expect(page.locator('#staffProgressBar')).toHaveAttribute('aria-valuenow','100');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('completed invitation stays readable after copying, with warning only before successful copy',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 test.setTimeout(65000);
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
 await owner(page,context);
 const email=emailFor(info);
 await fillWizard(page,email);
 await page.locator('#employeeConfirmed').check();
 await page.locator('#staffNext').click();
 await expect(page.locator('#onboardComplete')).toBeVisible();
 await expect(page.locator('#onboardingWizard')).toBeHidden();
 const field=page.getByLabel('Invitation URL');
 await expect(field).toBeVisible();
 const invitation=await field.inputValue();
 expect(invitation).toMatch(/\/employee-enrollment#/);
 await page.getByRole('link',{name:'Manage access'}).click();
 await expect(page.getByRole('dialog')).toContainText('not been copied');
 await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();
 await expect(page).toHaveURL(/\/employees\/onboarding$/);
 await page.getByRole('button',{name:'Copy invitation link'}).click();
 await expect(page.locator('#copyEmployeeHandoffLabel')).toHaveText('Copied');
 await expect(field).toHaveValue(invitation);
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(invitation);
 await page.getByRole('link',{name:'Manage access'}).click();
 await expect(page).toHaveURL(/\/employees\/[^/]+\/account-link$/);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('#employeeHandoffValue')).toHaveCount(0);
});

test('invitation API failure leaves saved employee and routes recovery to Manage access',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await owner(page,context);
 const email=emailFor(info);
 await page.route('**/api/employee-enrollment/employees/*',route=>route.request().method()==='POST'?
  route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'ENROLLMENT_RECOVERY_REQUIRED'})}):route.continue());
 await fillWizard(page,email);
 await page.locator('#employeeConfirmed').check();
 await page.locator('#staffNext').click();
 await expect(page.getByRole('heading',{name:'Employee saved',exact:true})).toBeVisible();
 await expect(page.locator('#onboardRecovery')).toBeVisible();
 await expect(page.locator('#employeeHandoffPanel')).toBeHidden();
 await expect(page.locator('#checkEmployeeStatus')).toBeHidden();
 await page.getByRole('link',{name:'Manage access'}).click();
 await expect(page).toHaveURL(/\/employees\/[^/]+\/account-link$/);
 const result=await (await context.request.get('/api/employees?search='+encodeURIComponent(email))).json();
 expect(result.employees.filter(e=>e.email===email)).toHaveLength(1);
});

test('lost employee creation response does not invite blind retry or duplicate creation',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await owner(page,context);
 const email=emailFor(info);
 await page.route('**/api/employees',route=>route.request().method()==='POST'?route.abort('failed'):route.continue());
 await fillWizard(page,email);
 await page.locator('#employeeConfirmed').check();
 await page.locator('#staffNext').click();
 await expect(page.getByRole('heading',{name:'Creation status unknown'})).toBeVisible();
 await expect(page.locator('#checkEmployeeStatus')).toBeVisible();
 await expect(page.locator('#onboardAnother')).toBeHidden();
 await expect(page.locator('#employeeHandoffPanel')).toBeHidden();
 await page.locator('#checkEmployeeStatus').click();
 await expect(page.locator('#onboardRecoveryMessage')).toContainText('original request remains unconfirmed');
 const result=await (await context.request.get('/api/employees?search='+encodeURIComponent(email))).json();
 expect(result.employees.filter(e=>e.email===email)).toHaveLength(0);
});
