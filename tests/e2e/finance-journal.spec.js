const {test,expect}=require('@playwright/test');
const cookie=value=>({name:'vsph.portal.sid',value,url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'});
test('owner searches all historical journal pages and receipt/date filters; ordinary users deny',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL history fixtures');
 await context.addCookies([cookie('fixture-admin-session')]);await page.goto('/admin/finance/journal');
 await page.getByRole('searchbox',{name:'Reference, customer or project'}).fill('JOURNAL-E2E');await page.getByRole('button',{name:'Apply Filters',exact:true}).click();
 await expect(page.locator('#journalPage')).toHaveText('Page 1');await expect(page.locator('#journalResult tbody tr')).toHaveCount(25);
 const seen=[];for(const number of [1,2,3]){
  await expect(page.locator('#journalPage')).toHaveText('Page '+number);
  seen.push(...await page.locator('#journalResult tbody tr td:first-child').allTextContents());
  if(number<3)await page.getByRole('button',{name:'Next Page',exact:true}).click();
 }
 expect(seen.length).toBe(61);expect(new Set(seen).size).toBe(61);await expect(page.getByRole('button',{name:'Next Page',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Previous Page',exact:true}).click();await expect(page.locator('#journalPage')).toHaveText('Page 2');
 await page.getByLabel('Records',{exact:true}).selectOption('receipts');await page.getByLabel('Status',{exact:true}).selectOption('reversed');await page.getByRole('button',{name:'Apply Filters',exact:true}).click();
 await expect(page.locator('#journalPage')).toHaveText('Page 1');await expect(page.locator('#journalResult')).toContainText('RECEIPT-JOURNAL-E2E');await expect(page.locator('#journalResult')).toContainText('Reversed');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('finance-history-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.getByLabel('From date',{exact:true}).fill('2026-01-01');await page.getByRole('button',{name:'Apply Filters',exact:true}).click();await expect(page.locator('#journalResult')).toContainText('No matching records.');
 await page.getByLabel('To date',{exact:true}).fill('2025-01-01');await page.getByRole('button',{name:'Apply Filters',exact:true}).click();await expect(page.locator('#journalStatus')).toContainText('must not be later');await expect(page.locator('#journalResult')).toBeEmpty();
 await context.clearCookies();await context.addCookies([cookie('fixture-outsider-session')]);expect((await context.request.get('/api/finance/journal')).status()).toBe(403);expect((await page.goto('/admin/finance/journal')).status()).toBe(403);
});

test('journal schema failure, cursor denial and refresh failure clear old rows and recover safely',async({page,context})=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Explicit transport failures over the isolated authenticated fixture');
 await context.addCookies([cookie('fixture-admin-session')]);let mode='schema';
 await page.route('**/api/finance/journal?**',route=>mode==='schema'?route.fulfill({status:503,json:{code:'SCHEMA_NOT_READY'}}):mode==='denied'?route.fulfill({status:403,json:{}}):mode==='cursor'&&new URL(route.request().url()).searchParams.has('cursor')?route.fulfill({status:400,json:{}}):route.continue());
 await page.goto('/admin/finance/journal');await expect(page.locator('#journalStatus')).toContainText('database migration is required');await expect(page.locator('#journalResult')).toBeEmpty();
 mode='real';await page.getByRole('button',{name:'Retry Page',exact:true}).click();await expect(page.locator('#journalPage')).toHaveText('Page 1');
 mode='cursor';await page.getByRole('button',{name:'Next Page',exact:true}).click();await expect(page.locator('#journalStatus')).toContainText('outdated filters/cursor');await expect(page.locator('#journalResult')).toBeEmpty();
 mode='real';await page.getByRole('button',{name:'Retry Page',exact:true}).click();await expect(page.locator('#journalPage')).toHaveText('Page 2');
 mode='denied';await page.getByRole('button',{name:'Retry Page',exact:true}).click();await expect(page.locator('#journalStatus')).toContainText('no longer available');await expect(page.locator('#journalResult')).toBeEmpty();
 mode='real';await page.getByRole('button',{name:'Apply Filters',exact:true}).click();await expect(page.locator('#journalPage')).toHaveText('Page 1');
});
