const {test,expect}=require('@playwright/test');
test('separate notification, reporting and security pages replace portfolio clutter',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 await page.goto('/projects');
 await expect(page.locator('#projectOperations')).toHaveCount(0);
 await expect(page.locator('#accountSessions')).toHaveCount(0);
 await page.goto('/notifications');
 await expect(page.locator('#notificationList')).toBeVisible();
 await expect(page.locator('#projectReport')).toBeHidden();
 await page.goto('/reports');
 await expect(page.locator('#projectReport')).toBeVisible();
 await expect(page.locator('#notificationList')).toBeHidden();
 await page.goto('/account/security');
 await expect(page.locator('#sessionList li').first()).toContainText('Current session');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('project creation renders responsive owner-governed manager modal',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 await page.goto('/projects');
 await page.getByRole('button',{name:'New project',exact:true}).click();
 await expect(page.locator('#creation')).toHaveAttribute('aria-modal','true');
 const form=page.locator('#createProjectForm');
 await form.getByLabel('Project key').fill('PREVIEW-'+info.project.name.toUpperCase());
 await form.getByLabel('Project name',{exact:true}).fill('Modern workspace preview');
 await form.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(form.getByLabel('Project manager')).toContainText('staff '+info.project.name);
 await expect(page.locator('#projectCreateOverlay')).toBeVisible();
});

test('archived employee email leads to owner-reviewed restoration without duplicate roster',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 const {randomUUID}=require('node:crypto');
 const email='restore-'+randomUUID()+'@fixture.test';
 const payload={fullName:'Rehire fixture',email,department:'Engineering',jobTitle:'Developer',employmentType:'full_time',startDate:'2026-11-09'};
 const created=await context.request.post('/api/employees',{headers:{'Idempotency-Key':randomUUID(),Origin:'http://127.0.0.1:3100'},data:payload});
 expect(created.status()).toBe(201);
 const person=await created.json();
 const removed=await context.request.post('/api/employees/'+person.id+'/remove',{headers:{Origin:'http://127.0.0.1:3100'},data:{version:person.version,reason:'Employee left the company',confirmed:true}});
 expect(removed.status()).toBe(200);
 const repeated=await context.request.post('/api/employees',{headers:{'Idempotency-Key':randomUUID(),Origin:'http://127.0.0.1:3100'},data:payload});
 expect(repeated.status()).toBe(409);
 expect((await repeated.json()).code).toBe('EMPLOYEE_ARCHIVED');
 await page.goto('/employees?restore='+person.id);
 await expect(page.locator('#restoreEmployeeForm')).toBeVisible();
 await expect(page.locator('#employeeRestoreIdentity')).toContainText(email);
 await page.locator('#employeeRestoreReason').fill('Owner approved rehire and fresh onboarding');
 await page.locator('#employeeRestoreConfirmed').check();
 await page.locator('#restoreEmployeeForm').getByRole('button',{name:'Restore employee'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Restore employee'}).click();
 await expect(page.locator('#archivedEmployeesMessage')).toContainText('Restored successfully');
 const result=await context.request.get('/api/employees/restore-lookup?email='+encodeURIComponent(email));
 const restored=(await result.json()).employee;
 expect(restored.id).toBe(person.id);
 expect(restored.archived).toBe(false);
 expect(restored.status).toBe('onboarding');
});

test('project actions archive then allow owner deletion only after explicit key confirmation',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100'}]);
 const key='ARCHIVE-'+info.project.name.toUpperCase()+'-'+info.retry;
 const data={key,name:'Temporary project for safe deletion',kind:'internal'};
 // Prove CSRF protection is still enforced before sending a real owner write.
 const withoutOrigin=await context.request.post('/api/projects',{data});
 expect(withoutOrigin.status()).toBe(403);
 const foreignOrigin=await context.request.post('/api/projects',{
   headers:{Origin:'https://untrusted.example'},data
 });
 expect(foreignOrigin.status()).toBe(403);
 const created=await context.request.post('/api/projects',{
   headers:{Origin:'http://127.0.0.1:3100'},data
 });
 expect(created.status(),JSON.stringify(await created.json())).toBe(201);
 const project=await created.json();
 await page.goto('/projects');
 const row=page.locator('#projectList tr').filter({hasText:key});
 await row.locator('.project-row-menu summary').click();
 await row.getByRole('button',{name:'Archive project'}).click();
 await page.locator('.vsph-ui-dialog').getByRole('button',{name:'Archive project'}).click();
 await expect(page.locator('#projectMessage')).toContainText('archived');
 await row.locator('.project-row-menu summary').click();
 await row.getByRole('button',{name:'Permanently delete'}).click();
 await expect(page.locator('#projectDeleteDialog')).toBeVisible();
 await page.locator('#projectDeleteKey').fill(key);
 await page.locator('#confirmProjectDelete').click();
 await expect(page.locator('#projectMessage')).toContainText('permanently deleted');
 expect((await context.request.get('/api/projects/'+project.id)).status()).toBe(403);
});
