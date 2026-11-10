const {test,expect}=require('@playwright/test');
test('owner records INR invoice, receipt and persistent real totals; outsider is denied',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE||info.project.name!=='desktop','Run with isolated native database on desktop');
 test.setTimeout(55000);
 const org='ffffffff-1111-4111-8111-111111111111',date=new Date().toISOString().slice(0,10);
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 await page.goto('/admin/finance');
 await expect(page.locator('#financeStatus')).toContainText('Live ledger loaded');
 await expect(page.locator('#finCollected')).toContainText('₹0.00');
 await page.locator('#invoiceOrg').selectOption(org);
 await page.locator('#financeInvoiceForm [name=reference]').fill('E2E-FIN-'+info.retry);
 await page.locator('#financeInvoiceForm [name=amountRupees]').fill('100.00');
 await page.locator('#financeInvoiceForm [name=issuedOn]').fill(date);
 await page.locator('#financeInvoiceForm [name=dueOn]').fill(date);
 await page.locator('#financeInvoiceForm [name=confirmed]').check();
 await page.getByRole('button',{name:'Save Invoice'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await expect(page.locator('#financeStatus')).toContainText('Invoice saved');
 await expect(page.locator('#finInvoiced')).toHaveText('₹100.00');
 await expect(page.locator('#finCollected')).toHaveText('₹0.00');
 await expect(page.locator('#financeInvoiceRows')).toContainText('E2E-FIN-'+info.retry);
 const invoiceId=await page.locator('#paymentInvoice option').last().getAttribute('value');
 expect(invoiceId).toBeTruthy();
 await page.locator('#paymentInvoice').selectOption(invoiceId);
 await page.locator('#financePaymentForm [name=reference]').fill('E2E-REC-'+info.retry);
 await page.locator('#financePaymentForm [name=amountRupees]').fill('30.00');
 await page.locator('#financePaymentForm [name=receivedOn]').fill(date);
 await page.locator('#financePaymentForm [name=confirmed]').check();
 await page.getByRole('button',{name:'Record Receipt'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await expect(page.locator('#financeStatus')).toContainText('Receipt recorded');
 await expect(page.locator('#finCollected')).toHaveText('₹30.00');
 await expect(page.locator('#finOutstanding')).toHaveText('₹70.00');
 const persisted=await (await context.request.get('/api/finance')).json();
 expect(persisted.summary.collectedPaise).toBe('3000');
 expect(persisted.invoices.find(x=>x.id===invoiceId).amount_paise).toBe('10000');
 await page.reload();
 await expect(page.locator('#financeStatus')).toContainText('Live ledger loaded');
 await expect(page.locator('#finCollected')).toHaveText('₹30.00');
 await expect(page.locator('#financePaymentRows')).toContainText('E2E-REC-'+info.retry);
 await page.goto('/dashboard');await expect(page.locator('#ownerOverviewStatus')).toContainText('Recorded balances loaded');
 await expect(page.locator('#ownerCollected')).toHaveText('₹30.00');
 await expect(page.locator('#ownerOutstanding')).toHaveText('₹70.00');
 await page.goto('/admin/finance');await expect(page.locator('#financeStatus')).toContainText('Live ledger loaded');
 await info.attach('finance-owner-ledger',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await context.clearCookies();
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-outsider-session',url:'http://127.0.0.1:3100'}]);
 expect((await context.request.get('/api/finance')).status()).toBe(403);
 expect((await context.request.get('/admin/finance')).status()).toBe(403);
});

test('exact decimal money renders beyond JS safe integers on desktop and mobile',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires the isolated authenticated fixture');
 await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
 // Explicit transport fixture for presentation only; native tests prove the real
 // HTTP/SQL report returns these exact string values, including concurrent writes.
 await page.route('**/api/finance/',route=>route.fulfill({json:{
  summary:{invoicedPaise:'9008000000000001',collectedPaise:'9008000000000001',outstandingPaise:'0',pastDuePaise:'0',issuedInvoices:9009,voidInvoices:0,clients:1,projects:0},
  byClient:[],byProject:[],monthly:[],invoices:[],payments:[],currency:'INR',basis:'manual_cash_receipts'
 }}));
 await page.goto('/admin/finance');
 await expect(page.locator('#financeStatus')).toContainText('Live ledger loaded');
 await expect(page.locator('#finInvoiced')).toHaveText('₹9,00,80,00,00,00,000.01');
 await expect(page.locator('#finCollected')).toHaveText('₹9,00,80,00,00,00,000.01');
 await expect(page.locator('#finOutstanding')).toHaveText('₹0.00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
