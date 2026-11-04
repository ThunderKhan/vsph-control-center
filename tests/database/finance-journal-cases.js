const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{once}=require('node:events'),{hashToken}=require('../../tokens');
module.exports=async pool=>{
 const owner=randomUUID(),outsider=randomUUID(),org=randomUUID(),other=randomUUID(),project=randomUUID(),prefix='JRN-'+randomUUID().slice(0,8),raw='journal-'+randomUUID();
 for(const [id,role] of [[owner,'super_admin'],[outsider,'user']]){await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Journal fixture',$2,$3)",[id,id+'@fixture.test',role]);}
 await pool.query("insert into organizations(id,name,slug) values($1,'Historical journal customer',$2),($3,'Other journal customer',$4)",[org,'journal-'+org,other,'journal-'+other]);
 await pool.query("insert into organization_memberships(organization_id,user_id,role,status) values($1,$2,'owner','active')",[org,outsider]);
 await pool.query("insert into projects(id,key,name,kind,customer_organization_id,owner_id,created_by) values($1,'JOURNAL-TEST','Journal project','customer',$2,$3,$3)",[project,org,owner]);
 await pool.query(`insert into finance_invoices(idempotency_key,request_hash,reference,organization_id,project_id,amount_paise,issued_on,due_on,created_by,created_at,status,voided_at,void_reason)
  select gen_random_uuid(),md5(g::text),$4||'-'||lpad(g::text,3,'0'),$1,$2,101,'2025-01-01','2025-01-31',$3,
  '2025-01-01T00:00:00Z'::timestamptz+(g/2)*interval '1 microsecond',case when g%4=0 then 'void' else 'issued' end,case when g%4=0 then now() end,case when g%4=0 then 'Synthetic historical correction' end from generate_series(1,60) g`,[org,project,owner,prefix]);
 await pool.query(`insert into finance_payments(idempotency_key,request_hash,invoice_id,reference,amount_paise,received_on,recorded_at,recorded_by)
  select gen_random_uuid(),md5(reference),id,'PAY-'||reference,101,'2025-01-06',created_at,$1 from finance_invoices where organization_id=$2`,[owner,org]);
 await pool.query(`insert into finance_payment_reversals(payment_id,reason,reversed_by) select p.id,'Synthetic receipt correction',$1 from finance_payments p join finance_invoices i on i.id=p.invoice_id where i.organization_id=$2 and (right(i.reference,3)::int%2=1 or i.status='void')`,[owner,org]);
 const call=async(actor=owner,kind='invoices',data={})=>(await pool.query('select finance_journal($1,$2,null,$3) d',[actor,kind,data])).rows[0].d;
 const filters={organizationId:org,search:prefix},first=await call(owner,'invoices',filters);assert.equal(first.items.length,25);assert.ok(first.nextCursor);assert.match(first.nextCursor.at,/\.0000\d{2}/);
 assert.ok(first.items.every(x=>x.amount_paise==='101'&&typeof x.collected_paise==='string'));
 await assert.rejects(call(outsider,'invoices',filters),{code:'42501'});await assert.rejects(call(null,'invoices',filters),{code:'42501'});
 for(const data of [{limit:1000},{offset:10},{organizationId:1},{status:'active'},{search:'a'.repeat(101)},{cursor:null},{cursor:{}},{cursor:{...first.nextCursor,scope:'b'.repeat(32)}},{...filters,projectId:project,cursor:first.nextCursor}])await assert.rejects(call(owner,'invoices',data),{code:'22023'});
 await assert.rejects(call(owner,'invoices',{...filters,cursor:{...first.nextCursor,at:'2025-99-99T00:00:00Z'}}),{code:'22023'});
 // A newly inserted head does not duplicate/displace existing cursor pages.
 await pool.query(`insert into finance_invoices(idempotency_key,request_hash,reference,organization_id,amount_paise,issued_on,due_on,created_by) values(gen_random_uuid(),md5('new'),$1,$2,1,'2025-01-01','2025-01-31',$3)`,[prefix+'-NEW',org,owner]);
 const seen=[...first.items];let cursor=first.nextCursor;
 while(cursor){const page=await call(owner,'invoices',{...filters,cursor});assert.ok(page.items.length<=25);seen.push(...page.items);cursor=page.nextCursor;}
 assert.equal(seen.length,60);assert.equal(new Set(seen.map(x=>x.id)).size,60);assert.ok(!seen.some(x=>x.reference===prefix+'-NEW'));
 assert.equal((await call(owner,'invoices',filters)).items[0].reference,prefix+'-NEW');
 assert.equal((await call(owner,'invoices',{...filters,status:'void'})).items.length,15);
 assert.equal((await call(owner,'invoices',{organizationId:other,projectId:project})).items.length,0);
 assert.equal((await call(owner,'invoices',{...filters,from:'2025-01-02'})).items.length,0);
 assert.equal((await call(owner,'invoices',{...filters,search:'Historical journal customer',projectId:project})).items.length,25);
 assert.equal((await call(owner,'receipts',{organizationId:org,status:'active'})).items.length,15);
 let receiptCursor=null,receipts=[];do{const page=await call(owner,'receipts',{...filters,...(receiptCursor?{cursor:receiptCursor}:{})});receipts.push(...page.items);receiptCursor=page.nextCursor;}while(receiptCursor);
 assert.equal(receipts.length,60);assert.equal(new Set(receipts.map(x=>x.id)).size,60);assert.equal(receipts.filter(x=>x.reversed).length,45);
 assert.ok(receipts.every(x=>x.amount_paise==='101'));
 // Populated synthetic upgrade and transaction rollback rehearsal. Only this
 // disposable database is touched; no bootstrap/customer seed or hosted SQL.
 const upgrade=await pool.connect();try{
  await upgrade.query('begin');
  const fingerprint=async()=>(await upgrade.query('select md5(jsonb_agg(to_jsonb(i) order by i.id)::text) fingerprint from finance_invoices i where organization_id=$1',[org])).rows[0].fingerprint;
  const before=await fingerprint();
  await upgrade.query('drop function finance_journal(uuid,text,uuid,jsonb);drop index finance_invoices_journal_order;drop index finance_invoices_journal_date;drop index finance_payments_journal_order;drop index finance_payments_journal_date');
  await upgrade.query(require('node:fs').readFileSync('supabase/migrations/20261104053000_finance_journal.sql','utf8'));
  assert.equal(await fingerprint(),before,'Index/RPC installation must preserve populated invoice records');
  assert.equal((await upgrade.query("select finance_journal($1,'invoices',null,$2) d",[owner,filters])).rows[0].d.items.length,25);
  await assert.rejects(upgrade.query("select finance_journal($1,'invoices',null,'{}')",[outsider]),{code:'42501'});
 }finally{await upgrade.query('rollback');upgrade.release();}
 const c=await pool.connect();try{for(const role of ['anon','authenticated']){await c.query('set role '+role);await assert.rejects(c.query("select finance_journal($1,'invoices',null,'{}')",[owner]),{code:'42501'});await c.query('reset role');}}finally{c.release();}
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",[hashToken(raw),owner,hashToken(raw+'-other'),outsider]);
 const server=require('./http-fixture')(pool).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const request=path=>fetch(base+path,{headers:{Cookie:'vsph.portal.sid='+raw}});
 try{
  let response=await request('/api/finance/journal?organizationId='+org);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');let page=await response.json();
  response=await request('/api/finance/journal?organizationId='+org+'&cursor='+encodeURIComponent(JSON.stringify(page.nextCursor)));assert.equal(response.status,200);assert.equal((await response.json()).items.length,25);
  assert.equal((await request('/api/finance/journal?limit=9999')).status,400);assert.equal((await fetch(base+'/api/finance/journal')).status,401);
  assert.equal((await fetch(base+'/api/finance/journal',{headers:{Cookie:'vsph.portal.sid='+raw+'-other'}})).status,403);
  assert.equal((await fetch(base+'/admin/finance/journal',{headers:{Cookie:'vsph.portal.sid='+raw+'-other'}})).status,403);
  await pool.query('alter function finance_journal(uuid,text,uuid,jsonb) rename to finance_journal_fixture_unavailable');
  try{response=await request('/api/finance/journal');assert.equal(response.status,503);assert.equal((await response.json()).code,'SCHEMA_NOT_READY');}finally{await pool.query('alter function finance_journal_fixture_unavailable(uuid,text,uuid,jsonb) rename to finance_journal');}
  await pool.query("update portal_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[hashToken(raw)]);assert.equal((await request('/api/finance/journal')).status,401);
  await pool.query("update profiles set platform_role='user' where id=$1",[owner]);await assert.rejects(call(),{code:'42501'});
 }finally{await new Promise(resolve=>server.close(resolve));}
};
