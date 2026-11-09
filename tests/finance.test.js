const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {validate}=require('../routes/finance');
const invoice=()=>({reference:'INV-2026-101',
 organizationId:'11111111-1111-4111-8111-111111111111',
 projectId:null,amountPaise:10050,issuedOn:'2026-11-03',dueOn:'2026-11-30'});
test('finance validates integer paise, customer linkage and strict mutation fields',()=>{
 assert.deepEqual(validate('invoice.create',invoice()),invoice());
 for(const change of [
  {amountPaise:0},{amountPaise:1.5},{amountPaise:'10050'},{amountPaise:1000000000001},
  {organizationId:'x'},{projectId:'not-a-uuid'},{issuedOn:'2026-02-30'},
  {dueOn:'2026-10-01'},{reference:'<invalid>'},{platformRole:'super_admin'}
 ])assert.throws(()=>validate('invoice.create',{...invoice(),...change}));
 const payment={idempotencyKey:'22222222-2222-4222-8222-222222222222',
  reference:'BANK-2026-1',amountPaise:10050,receivedOn:'2026-11-03'};
 assert.equal(validate('payment.record',payment).amountPaise,10050);
 assert.throws(()=>validate('payment.record',{...payment,amountPaise:'10050'}));
 assert.throws(()=>validate('payment.record',{...payment,actor:'owner'}));
 assert.deepEqual(validate('invoice.void',{version:2,reason:'Incorrect invoice',confirmed:true}),
  {version:2,reason:'Incorrect invoice',confirmed:true});
 assert.throws(()=>validate('invoice.void',{version:2,reason:'short',confirmed:true}));
 assert.throws(()=>validate('invoice.void',{version:2,reason:'Incorrect invoice',confirmed:false}));
 assert.throws(()=>validate('payment.reverse',{reason:'Incorrect receipt',confirmed:false}));
 assert.deepEqual(validate('payment.reverse',{reason:'Incorrect receipt',confirmed:true}),
  {reason:'Incorrect receipt',confirmed:true});
});
test('finance endpoints and page enforce owner session and explicit capability',()=>{
 const server=read('server.js'),route=read('routes/finance.js');
 assert.match(server,/app.use\('\/api\/finance',require\('\.\/routes\/finance'\)\.router\)/);
 assert.match(server,/app.get\('\/admin\/finance',portalSession,requireAdmin/);
 assert.match(route,/router.use\(portalSession,requireAdmin\)/);
 assert.match(route,/Idempotency-Key/);
 assert.match(route,/finance_command/);
 assert.doesNotMatch(read('public/dashboard.html'),/class="owner-data-footer"|class="owner-workflows"|class="owner-data-notes"/);
 assert.match(read('views/partials/portal-navigation.html'),/href="\/admin\/finance"/);
 assert.doesNotMatch(read('public/admin.html'),/Back to overview/);
 const html=read('views/finance.html');
 assert.match(html,/Manual cash ledger/);
 assert.match(html,/id="financeInvoiceForm"/);
 assert.match(html,/id="financePaymentForm"/);
 assert.match(html,/id="financeMonths"/);
 const js=read('public/finance.js');
 assert.match(js,/\/api\/finance/);
 assert.match(js,/BigInt/);
 assert.doesNotMatch(js,/Math\.random|localStorage|REVENUE_DEMO/);
 assert.match(read('public/finance.css'),/#00255A/);
 assert.match(read('public/finance.css'),/#0069C8/);
});
