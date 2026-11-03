const assert=require('node:assert/strict');
const crypto=require('node:crypto');
module.exports=async pool=>{
 const owner='f1111111-1111-4111-8111-111111111111';
 const outsider='f2222222-2222-4222-8222-222222222222';
 const customer='f3333333-3333-4333-8333-333333333333';
 const other='f4444444-4444-4444-8444-444444444444';
 const project='f5555555-5555-4555-8555-555555555555';
 for(const [id,email,role] of [[owner,'finance-owner@fixture.test','super_admin'],
  [outsider,'finance-outsider@fixture.test','user']]){
  await pool.query('insert into auth.users(id) values($1)',[id]);
  await pool.query('insert into profiles(id,full_name,email,platform_role) values($1,$2,$3,$4)',
   [id,email,email,role]);
 }
 await pool.query("insert into organizations(id,name,slug) values($1,'Ledger Customer','ledger-customer-fixture'),($2,'Other Ledger Customer','other-ledger-customer-fixture')",[customer,other]);
 await pool.query("insert into projects(id,key,name,kind,customer_organization_id,owner_id,created_by) values($1,'FINANCE-TEST','Finance Engagement','customer',$2,$3,$3)",[project,customer,owner]);
 const cmd=async(who,action,id=null,data={})=>
  (await pool.query('select public.finance_command($1,$2,$3,$4) output',[who,action,id,data])).rows[0].output;
 const today=new Date().toISOString().slice(0,10);
 const invoice=(ref,organizationId=customer,projectId=project,amountPaise=1000000)=>({
  reference:ref,organizationId,projectId,amountPaise,issuedOn:today,dueOn:today
 });
 const payment=(ref,amountPaise,idempotencyKey=crypto.randomUUID())=>
  ({idempotencyKey,reference:ref,amountPaise,receivedOn:today});
 const blank=await cmd(owner,'dashboard');
 assert.equal(blank.summary.invoicedPaise,0);
 assert.equal(blank.summary.collectedPaise,0);
 assert.equal(blank.summary.outstandingPaise,0);
 assert.equal(blank.invoices.length,0);
 assert.equal(blank.monthly.length,6);
 await assert.rejects(cmd(outsider,'dashboard'),{code:'42501'});
 await assert.rejects(cmd(outsider,'invoice.create',crypto.randomUUID(),invoice('FIN-OUTSIDER')),{code:'42501'});
 await assert.rejects(cmd(owner,'invoice.create',crypto.randomUUID(),invoice('FIN-OTHER',other,project)),{code:'42501'},'Cross-tenant project association must be impossible');
 const key=crypto.randomUUID(),first=invoice('FIN-INVOICE-001');
 const issued=await cmd(owner,'invoice.create',key,first);
 assert.equal(issued.version,1);assert.equal(issued.replayed,false);
 assert.equal((await cmd(owner,'invoice.create',key,first)).replayed,true);
 await assert.rejects(cmd(owner,'invoice.create',key,invoice('FIN-INVOICE-002')),{code:'23505'});
 await assert.rejects(cmd(owner,'invoice.create',crypto.randomUUID(),first),{code:'23505'});
 const billed=await cmd(owner,'dashboard');
 assert.equal(billed.summary.invoicedPaise,1000000);
 assert.equal(billed.summary.collectedPaise,0,'Issued invoices must not become cash revenue');
 assert.equal(billed.summary.outstandingPaise,1000000);
 assert.equal(billed.byProject[0].project_name,'Finance Engagement');
 assert.equal(billed.byClient[0].organization_name,'Ledger Customer');
 const payKey=crypto.randomUUID(),receipt=payment('FIN-RECEIPT-001',350000,payKey);
 const collected=await cmd(owner,'payment.record',issued.id,receipt);
 assert.equal(collected.replayed,false);
 assert.equal((await cmd(owner,'payment.record',issued.id,receipt)).replayed,true);
 await assert.rejects(cmd(owner,'payment.record',issued.id,payment('FIN-CHANGED-KEY',450000,payKey)),{code:'23505'});
 await assert.rejects(cmd(owner,'payment.record',issued.id,payment('FIN-OVERPAY',800000)),{code:'23514'});
 const races=await Promise.allSettled([
  cmd(owner,'payment.record',issued.id,payment('FIN-RACE-A',650000)),
  cmd(owner,'payment.record',issued.id,payment('FIN-RACE-B',650000))
 ]);
 assert.equal(races.filter(x=>x.status==='fulfilled').length,1,'Only one receipt fits the remaining balance');
 assert.equal(races.find(x=>x.status==='rejected').reason.code,'23514');
 const complete=await cmd(owner,'dashboard');
 assert.equal(complete.summary.invoicedPaise,1000000);
 assert.equal(complete.summary.collectedPaise,1000000);
 assert.equal(complete.summary.outstandingPaise,0);
 assert.equal(complete.byClient[0].collected_paise,1000000);
 assert.equal(complete.byProject[0].collected_paise,1000000);
 assert.equal(complete.monthly.at(-1).collected_paise,1000000);
 assert.ok(complete.payments.length>=2);
 await assert.rejects(cmd(owner,'invoice.void',issued.id,{version:1,reason:'wrong amount',confirmed:true}),{code:'40001'});
 await cmd(owner,'payment.reverse',collected.id,{reason:'Incorrect receipt entered',confirmed:true});
 await assert.rejects(cmd(owner,'payment.reverse',collected.id,{reason:'Repeat reversal blocked',confirmed:true}),{code:'40001'});
 const reversed=await cmd(owner,'dashboard');
 assert.equal(reversed.summary.collectedPaise,650000);
 assert.equal(reversed.summary.outstandingPaise,350000);
 assert.equal(reversed.payments.find(p=>p.id===collected.id).reversed,true);
 const active=await pool.query('select p.id from finance_payments p where p.invoice_id=$1 and not exists(select 1 from finance_payment_reversals r where r.payment_id=p.id)',[issued.id]);
 assert.equal(active.rowCount,1);
 await cmd(owner,'payment.reverse',active.rows[0].id,{reason:'Full refund recorded separately',confirmed:true});
 const zero=await cmd(owner,'dashboard');
 assert.equal(zero.summary.collectedPaise,0);
 assert.equal(zero.summary.outstandingPaise,1000000);
 await assert.rejects(cmd(owner,'invoice.void',issued.id,{version:2,reason:'Outdated version',confirmed:true}),{code:'40001'});
 const voided=await cmd(owner,'invoice.void',issued.id,{version:1,reason:'Invoice cancelled by owner',confirmed:true});
 assert.equal(voided.status,'void');
 const final=await cmd(owner,'dashboard');
 assert.equal(final.summary.invoicedPaise,0);
 assert.equal(final.summary.voidInvoices,1);
 assert.equal(final.summary.collectedPaise,0);
 assert.equal(final.invoices[0].status,'void');
 await assert.rejects(cmd(owner,'payment.record',issued.id,payment('FIN-NO-VOID',100)),{code:'40001'});
 const c=await pool.connect();
 try{for(const role of ['anon','authenticated']){
  await c.query('set role '+role);
  for(const table of ['finance_invoices','finance_payments','finance_payment_reversals'])
   await assert.rejects(c.query('select * from public.'+table),{code:'42501'});
  await assert.rejects(c.query("select public.finance_command($1,'dashboard',null,'{}')",[owner]),{code:'42501'});
  await c.query('reset role');
 }}finally{c.release();}
 await pool.query("create function public.finance_fail_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic finance audit failure';end$$;");
 await pool.query('create trigger finance_audit_fail before insert on public.audit_logs for each row execute function public.finance_fail_audit()');
 try{
  const k=crypto.randomUUID();
  await assert.rejects(cmd(owner,'invoice.create',k,invoice('FIN-ROLLBACK')),{code:'P0001'});
  assert.equal((await pool.query("select count(*) from finance_invoices where reference='FIN-ROLLBACK'")).rows[0].count,'0');
 }finally{
  await pool.query('drop trigger finance_audit_fail on public.audit_logs');
  await pool.query('drop function public.finance_fail_audit()');
 }
 assert.equal((await pool.query('select count(*) from user_app_roles where user_id=$1',[outsider])).rows[0].count,'0');
};
