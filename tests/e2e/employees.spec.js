const {test,expect}=require('@playwright/test');
const crypto=require('node:crypto');
test('owner onboards internal staff, sees persisted metrics, filters and cannot grant an account by creating a roster row',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native database');
 test.setTimeout(65000);
 const email='employee-'+info.project.name+'-'+info.retry+'@fixture.test';
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/dashboard');
 if(info.project.name==='desktop'){
  await expect(page.getByRole('link',{name:'Employee management'})).toBeVisible();
  await page.getByRole('link',{name:'New employee'}).click();
 } else {
  // The compact/mobile sidebar is collapsed by default; direct protected route
  // navigation tests the same server-side access boundary without expanding it.
  await page.goto('/employees/onboarding');
 }
 await expect(page).toHaveURL(/\/employees\/onboarding$/);
 await page.locator('input[name=fullName]').fill('E2E Sample Employee');
 await page.locator('input[name=email]').fill(email);
 await page.locator('#staffNext').click();
 await page.locator('input[name=department]').fill('Engineering');
 await page.locator('input[name=jobTitle]').fill('Software Developer');
 await page.locator('select[name=employmentType]').selectOption('intern');
 await page.locator('input[name=startDate]').fill('2026-11-03');
 await page.locator('#staffNext').click();
 await expect(page.locator('#employeeReview')).toContainText(email);
 await page.locator('#employeeConfirmed').check();
 await page.locator('#staffNext').click();
 await expect(page.locator('#onboardComplete')).toBeVisible();
 await expect(page.locator('#onboardCompleteMessage')).toContainText('Onboarding');
 await page.getByRole('link',{name:'View employee dashboard'}).click();
 await expect(page.locator('#employeeRows')).toContainText(email);
 await expect(page.locator('#staffOnboarding')).not.toHaveText('—');
 await page.locator('#employeeSearch').fill(email);
 await expect(page.locator('#employeeRows')).toContainText(email);
 await page.locator('#employeeStatus').selectOption('active');
 await expect(page.locator('#employeeRows')).not.toContainText(email);
 await page.locator('#employeeStatus').selectOption('all');
 await expect(page.locator('#employeeRows')).toContainText(email);
 await page.getByRole('button',{name:'Edit',exact:true}).last().click();
 await expect(page.locator('#employeeEditPanel')).toBeVisible();
 await page.locator('#employeeEditForm select[name=status]').selectOption('active');
 await page.locator('#employeeEditForm input[name=confirmed]').check();
 await page.getByRole('button',{name:'Save employee changes'}).click();
 await expect(page.locator('#peopleMessage')).toContainText('updated');
 await expect(page.locator('#employeeRows')).toContainText('Active');
 const directory=await context.request.get('/api/employees?search='+encodeURIComponent(email));
 expect(directory.status()).toBe(200);
 const data=await directory.json();
 expect(data.employees).toHaveLength(1);
 expect(data.employees[0].status).toBe('active');
 expect(data.employees[0].email).toBe(email);
 expect((await context.request.get('/api/employees/access')).status()).toBe(200);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await info.attach('staff-dashboard-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-outsider-session',url:'http://127.0.0.1:3100'}]);
 expect((await context.request.get('/api/employees')).status()).toBe(403);
 await page.goto('/employees');
 await expect(page.getByText('VSPH employee management requires owner or HR permission.')).toBeVisible();
});
test('owner can appoint HR only for a matching existing employee identity; HR cannot appoint others',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE||info.project.name!=='desktop','Once per fixture on desktop');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 page.on('dialog',dialog=>dialog.accept());
 const payload={fullName:'Fixture Developer',email:'developer@fixture.test',department:'Engineering',
 jobTitle:'Developer',employmentType:'full_time',startDate:'2026-11-03'};
 const headers={Origin:'http://127.0.0.1:3100','Idempotency-Key':crypto.randomUUID()};
 const created=await context.request.post('/api/employees',{headers,data:payload});
 expect(created.status()).toBe(201);
 const person=await created.json();
 const activated=await context.request.post('/api/employees/'+person.id+'/update',{headers:{Origin:'http://127.0.0.1:3100'},
  data:{fullName:payload.fullName,department:payload.department,jobTitle:payload.jobTitle,
   employmentType:payload.employmentType,startDate:payload.startDate,status:'active',version:1,confirmed:true}});
 expect(activated.status()).toBe(200);
 const linkRequest=await context.request.post('/api/employee-identity/employees/'+person.id+'/request',{headers:{Origin:'http://127.0.0.1:3100','Idempotency-Key':crypto.randomUUID()},data:{rosterVersion:2,confirmed:true}});expect(linkRequest.status()).toBe(200);const link=await linkRequest.json();
 await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:'fixture-developer-session',url:'http://127.0.0.1:3100'}]);
 const consent=await context.request.post('/api/employee-identity/requests/'+link.id+'/accept',{headers:{Origin:'http://127.0.0.1:3100'},data:{rosterVersion:2,requestVersion:1,confirmed:true,password:'fixture-password-only'}});expect(consent.status()).toBe(200);
 await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 const granted=await context.request.post('/api/employees/'+person.id+'/grant_hr',{headers:{Origin:'http://127.0.0.1:3100'},data:{version:2,confirmed:true}});
 expect(granted.status()).toBe(200);
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-developer-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 expect((await context.request.get('/api/employees/access')).status()).toBe(200);
 await page.goto('/employees');
 await expect(page.locator('#staffRole')).toHaveText('HR manager');
 await expect(page.locator('#hrGovernance')).toBeHidden();
 const attempted=await context.request.post('/api/employees/'+person.id+'/revoke_hr',{headers:{Origin:'http://127.0.0.1:3100'},data:{version:3,confirmed:true}});
 expect(attempted.status()).toBe(403);
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 const revoked=await context.request.post('/api/employees/'+person.id+'/revoke_hr',{headers:{Origin:'http://127.0.0.1:3100'},data:{version:3,confirmed:true}});
 expect(revoked.status()).toBe(200);
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-developer-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 expect((await context.request.get('/api/employees')).status()).toBe(403);
});
