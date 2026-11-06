const {test,expect}=require('@playwright/test'),crypto=require('node:crypto');
test('owner creates an employee login invitation and the employee chooses a password without acquiring HR or customer access',async({page,context,browser},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL and simulated Auth');test.setTimeout(65000);
 const origin='http://127.0.0.1:3100',email='enrollment-'+info.project.name+'-'+crypto.randomBytes(5).toString('hex')+'@fixture.test';
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:origin,httpOnly:true,sameSite:'Lax'}]);page.on('dialog',d=>d.accept());
 await page.goto('/employees/onboarding');await page.locator('[name=fullName]').fill('New employee '+info.project.name);await page.locator('[name=email]').fill(email);await page.locator('#staffNext').click();
 await page.locator('[name=department]').fill('Engineering');await page.locator('[name=jobTitle]').fill('Developer');await page.locator('[name=employmentType]').selectOption('intern');await page.locator('[name=startDate]').fill('2026-11-06');await page.locator('#staffNext').click();await page.locator('#employeeConfirmed').check();await page.locator('#staffNext').click();
 const field=page.getByLabel('One-time handoff details',{exact:true});await expect(field).toBeVisible();const url=await field.inputValue();expect(url).toContain('/employee-enrollment#');
 await page.getByRole('link',{name:'Set up employee login',exact:true}).click();
 await expect(page.getByRole('button',{name:'Reissue login invitation',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Employee setup link',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Reissue login invitation',exact:true})).toBeVisible();
 const employeeContext=await browser.newContext({viewport:info.project.name==='mobile'?{width:390,height:844}:{width:1280,height:800}}),employee=await employeeContext.newPage();
 try{
  await employee.goto(url);await expect(employee.locator('#enrollmentForm')).toBeVisible();expect(new URL(employee.url()).hash).toBe('');await expect(employee.locator('#enrollmentInfo')).toContainText(email);
  await employee.getByLabel('New password',{exact:true}).fill('private-employee-password-2026');await employee.getByLabel('Confirm password',{exact:true}).fill('private-employee-password-2026');await employee.locator('#enrollmentConsent').check();await employee.getByRole('button',{name:'Create my login',exact:true}).click();await expect(employee.locator('#enrollmentMessage')).toContainText('Your employee account is ready');
  await info.attach('employee-password-setup-'+info.project.name,{body:await employee.screenshot({fullPage:true}),contentType:'image/png'});
  await employee.getByRole('link',{name:'Go to sign in',exact:true}).click();await employee.locator('#email').fill(email);await employee.locator('#password').fill('private-employee-password-2026');await employee.locator('#authSubmit').click();await expect(employee).toHaveURL(/\/dashboard$/);await expect(employee.locator('html')).toHaveAttribute('data-navigation-ready','true');
  expect(await employee.locator('#adminNavContainer').evaluate(e=>e.hidden)).toBe(true);expect(await employee.locator('#employeeNavContainer').evaluate(e=>e.hidden)).toBe(true);
  expect((await employeeContext.request.get('/api/employees')).status()).toBe(403);expect((await employeeContext.request.get('/hr/access')).status()).toBe(403);expect((await employeeContext.request.get('/api/apps/CRM/records')).status()).toBe(401);expect((await employeeContext.request.get('/apps/crm/login')).status()).toBe(403);
  await employee.goto('/employment');await expect(employee.locator('#identityContent')).toContainText('Engineering');await employee.reload();await expect(employee.locator('#identityContent')).toContainText('Developer');
  await employee.goto(url);await expect(employee.locator('#enrollmentForm')).toBeHidden();await expect(employee.locator('#enrollmentMessage')).not.toHaveText('');
 }finally{await employeeContext.close();}
});
