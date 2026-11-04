const {test,expect}=require('@playwright/test');
test('employee self-service and HR review preserve role and private-record boundaries',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 test.setTimeout(60000);
 const layout=info.project.name,origin='http://127.0.0.1:3100';
 const signin=async role=>{await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:'fixture-hrms-'+role+'-'+layout,url:origin,httpOnly:true,sameSite:'Lax'}]);};
 await signin('staff');expect((await context.request.get('/hr')).status()).toBe(403);expect((await context.request.get('/api/employees')).status()).toBe(403);expect((await context.request.get('/hr/access')).status()).toBe(403);
 await page.goto('/my-work');await expect(page.locator('#hrContent')).toBeVisible();await expect(page.locator('#ownTasks').getByRole('heading',{name:'Implement assigned feature '+layout,exact:true})).toBeVisible();
 if(await page.getByRole('button',{name:'Set in progress',exact:true}).count())await page.getByRole('button',{name:'Set in progress',exact:true}).click();await expect(page.locator('#ownTasks')).toContainText('in progress');await page.reload();await expect(page.locator('#ownTasks')).toContainText('in progress');
 if(await page.getByRole('button',{name:'Check in',exact:true}).count())await page.getByRole('button',{name:'Check in',exact:true}).click();if(await page.getByRole('button',{name:'Check out',exact:true}).count())await page.getByRole('button',{name:'Check out',exact:true}).click();await expect(page.locator('#ownAttendance')).toContainText('closed');
 await page.getByLabel('From',{exact:true}).fill('2026-12-'+(20+info.retry*3));await page.getByLabel('Through',{exact:true}).fill('2026-12-'+(21+info.retry*3));await page.getByLabel('Reason',{exact:true}).fill('Private leave '+layout+' attempt '+info.retry);await page.getByRole('button',{name:'Submit leave request',exact:true}).click();await expect(page.locator('#ownLeave')).toContainText('pending');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await info.attach('employee-workspace-'+layout,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await signin('hr');expect((await context.request.get('/hr/access')).status()).toBe(403);await page.goto('/hr');await expect(page.locator('#hrContent')).toBeVisible();await expect(page.getByRole('link',{name:'Manage HR access',exact:true})).toBeHidden();
 const request=page.locator('#leaveQueue .hr-record').filter({hasText:'Private leave '+layout+' attempt '+info.retry});await request.getByLabel('Decision',{exact:true}).selectOption('approved');await request.getByRole('checkbox').check();await request.getByRole('button',{name:'Save review',exact:true}).click();await expect(request).toHaveCount(0);
 await signin('staff');await page.goto('/my-work');await expect(page.locator('#ownLeave')).toContainText('approved');
 await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:'fixture-outsider-session',url:origin,httpOnly:true,sameSite:'Lax'}]);expect((await context.request.get('/api/hrms/me')).status()).toBe(403);expect((await context.request.get('/api/hrms/leave')).status()).toBe(403);
});
