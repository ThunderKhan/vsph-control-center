const {test,expect}=require('@playwright/test');
const cookie=value=>({name:'vsph.portal.sid',value,url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'});
const format=value=>{const n=BigInt(value);return '₹'+(n/100n).toLocaleString('en-IN')+'.'+(n%100n).toString().padStart(2,'0');};
test('owner landing reads real persisted balances, preview is explicit and ordinary users cannot read it',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 await context.addCookies([cookie('fixture-admin-session')]);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/finance/overview'));
 await page.goto('/dashboard');const read=await response;expect(read.status()).toBe(200);const report=await read.json();
 await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
 await expect(page.locator('#ownerCollected')).toHaveText(format(report.summary.collectedPaise));
 await expect(page.locator('#ownerInvoiced')).toHaveText(format(report.summary.invoicedPaise));
 await expect(page.locator('#ownerOverviewMonths li')).toHaveCount(6);
 await expect(page.locator('#executiveDashboard')).toBeHidden();
 expect(Object.keys(report).sort()).toEqual(['asOf','basis','currency','monthly','summary']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('owner-recorded-overview-'+info.project.name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.goto('/dashboard?preview=executive');
 await expect(page.locator('#executiveDashboard')).toBeVisible();await expect(page.locator('#executiveDashboard')).toContainText('Illustrative data only.');await expect(page.locator('#ownerOverview')).toBeHidden();
 await page.getByRole('link',{name:'Return to recorded operating overview',exact:true}).click();await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
 await context.clearCookies();await context.addCookies([cookie('fixture-outsider-session')]);
 await page.goto('/dashboard?preview=executive');await expect(page.locator('#topAccount')).toContainText('Fixture Outsider');
 await expect(page.locator('#ownerOverview')).toBeHidden();await expect(page.locator('#executiveDashboard')).toBeHidden();
 expect((await context.request.get('/api/finance/overview')).status()).toBe(403);
});

test('owner overview clears failures, retries, preserves exact money and bounds a stalled request',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'UI transport failures over an isolated authenticated fixture');test.setTimeout(45000);
 await context.addCookies([cookie('fixture-admin-session')]);
 const real=await (await context.request.get('/api/finance/overview')).json();
 const big=structuredClone(real);Object.assign(big.summary,{invoicedPaise:'9008000000000001',collectedPaise:'9008000000000001',outstandingPaise:'0',pastDuePaise:'0'});big.monthly.at(-1).collected_paise=big.summary.collectedPaise;
 let mode='schema',stalled;
 await page.route('**/api/finance/overview',async route=>{
  if(mode==='schema')return route.fulfill({status:503,json:{code:'SCHEMA_NOT_READY'}});
  if(mode==='denied')return route.fulfill({status:403,json:{message:'Access denied'}});
  if(mode==='timeout'){stalled=route;return;}
  if(mode==='invalid')return route.fulfill({json:{...big,summary:{...big.summary,collectedPaise:Number(big.summary.collectedPaise)}}});
  return route.fulfill({json:mode==='big'?big:real});
 });
 await page.goto('/dashboard');await expect(page.locator('#ownerOverviewStatus')).toContainText('database upgrade is required');await expect(page.locator('#ownerOverviewFacts')).toBeHidden();
 mode='real';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
 await expect(page.locator('#ownerCollected')).toHaveText(format(real.summary.collectedPaise));
 mode='big';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerCollected')).toHaveText('₹9,00,80,00,00,00,000.01');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 mode='invalid';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerOverviewStatus')).toContainText('no balances are estimated');await expect(page.locator('#ownerOverviewFacts')).toBeHidden();await expect(page.locator('#ownerCollected')).toHaveText('—');
 mode='big';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerCollected')).toHaveText('₹9,00,80,00,00,00,000.01');
 mode='denied';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerOverviewStatus')).toContainText('no longer available');await expect(page.locator('#ownerOverviewFacts')).toBeHidden();await expect(page.locator('#ownerCollected')).toHaveText('—');
 mode='timeout';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerOverviewStatus')).toContainText('timed out',{timeout:15000});await expect(page.getByRole('button',{name:'Refresh overview',exact:true})).toBeEnabled();
 await stalled.abort().catch(()=>{});mode='real';await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
});
