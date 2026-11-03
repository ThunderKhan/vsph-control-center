const {test,expect}=require('@playwright/test');
test('customer owner manages only an authorized organization and persists profile/member/product changes',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated database');
 const label=info.project.name,org='ffffffff-1111-4111-8111-11111111111'+(label==='desktop'?1:2),email='team-'+label+'@fixture.test';
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-customer-owner-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 page.on('dialog',dialog=>dialog.accept());await page.goto('/organizations');await page.getByLabel('Organization',{exact:true}).selectOption(org);
 await expect(page.locator('#organizationName')).toContainText('Customer '+label);await expect(page.locator('#detail')).toHaveAttribute('aria-busy','false');
 await page.getByLabel('Organization display name').fill('Customer '+label+' revised');await page.getByRole('button',{name:'Save organization name'}).click();await expect(page.locator('#message')).toHaveText('Organization updated.');
 await page.getByLabel('Customer Relationship Management role for '+email,{exact:true}).selectOption('viewer');await page.getByRole('button',{name:'Review Customer Relationship Management access',exact:true}).click();await expect(page.locator('#message')).toHaveText('Organization updated.');
 await page.getByLabel('Membership status for '+email,{exact:true}).selectOption('suspended');await page.getByRole('button',{name:'Review membership change',exact:true}).click();await expect(page.locator('#message')).toHaveText('Organization updated.');
 await page.reload();await page.getByLabel('Organization',{exact:true}).selectOption(org);await expect(page.locator('#organizationName')).toHaveText('Customer '+label+' revised');await expect(page.getByLabel('Membership status for '+email,{exact:true})).toHaveValue('suspended');await expect(page.locator('#activity')).toContainText('organization.member_updated');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('Organization display name').focus();await expect(page.getByLabel('Organization display name')).toBeFocused();
 await context.clearCookies();await context.addCookies([{name:'vsph.portal.sid',value:'fixture-outsider-session',url:'http://127.0.0.1:3100'}]);
 expect((await context.request.get('/api/organizations/'+org)).status()).toBe(403);await page.goto('/organizations');await expect(page.locator('#empty')).toBeVisible();
});
