const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{once}=require('node:events'),{hashToken}=require('../../tokens');
module.exports=async pool=>{
 const owner=randomUUID(),client=randomUUID(),outsider=randomUUID(),project=randomUUID(),raw='finance-exact-'+randomUUID();
 for(const [id,role] of [[owner,'super_admin'],[outsider,'user']]){
  await pool.query('insert into auth.users values($1)',[id]);
  await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Exact finance fixture',$2,$3)",[id,id+'@fixture.test',role]);
 }
 await pool.query("insert into organizations(id,name,slug) values($1,'Exact fixture customer',$2)",[client,'exact-'+client]);
 await pool.query("insert into organization_memberships(organization_id,user_id,role,status) values($1,$2,'customer_admin','active')",[client,outsider]);
 await pool.query("insert into projects(id,key,name,kind,customer_organization_id,owner_id,created_by) values($1,'EXACT-FINANCE','Exact fixture project','customer',$2,$3,$3)",[project,client,owner]);
 // 9,008 maximum-size invoices and one paise exceed JS safe integers. Test-only
 // data stays in the disposable loopback DB; no production seeding pathway.
 await pool.query(`insert into finance_invoices(idempotency_key,request_hash,reference,organization_id,project_id,amount_paise,issued_on,due_on,created_by)
  select gen_random_uuid(),md5(g::text),'EXACT-'||g,$1,$2,case when g=9009 then 1 else 1000000000000 end,current_date-2,current_date-1,$3 from generate_series(1,9009) g`,[client,project,owner]);
 const report=async(actor=owner,action='dashboard',id=null,data={})=>(await pool.query('select finance_report($1,$2,$3,$4) d',[actor,action,id,data])).rows[0].d;
 const exact='9008000000000001',before=await report();
 for(const key of ['invoicedPaise','outstandingPaise','pastDuePaise'])assert.equal(before.summary[key],exact);
 assert.equal(before.summary.collectedPaise,'0');
 const group=before.byClient.find(x=>x.organization_id===client);assert.equal(group.invoiced_paise,exact);assert.equal(group.outstanding_paise,exact);
 assert.equal(before.byProject.find(x=>x.project_id===project).invoiced_paise,exact);
 await pool.query(`insert into finance_payments(idempotency_key,request_hash,invoice_id,reference,amount_paise,received_on,recorded_by)
  select gen_random_uuid(),md5(reference),id,'RECEIPT-'||reference,amount_paise,current_date,$1 from finance_invoices where organization_id=$2`,[owner,client]);
 const paid=await report();assert.equal(paid.summary.collectedPaise,exact);assert.equal(paid.summary.outstandingPaise,'0');
 assert.equal(paid.byClient.find(x=>x.organization_id===client).collected_paise,exact);
 assert.equal(paid.byProject.find(x=>x.project_id===project).collected_paise,exact);
 assert.equal(paid.monthly.at(-1).collected_paise,exact);
 assert.ok(paid.invoices.every(x=>typeof x.amount_paise==='string'&&typeof x.collected_paise==='string'));
 assert.ok(paid.payments.every(x=>typeof x.amount_paise==='string'));
 const legacy=(await pool.query("select finance_command($1,'dashboard',null,'{}') d",[owner])).rows[0].d;
 assert.deepEqual(legacy,paid,'Legacy server-side reads must delegate to the same exact report');
 await assert.rejects(report(outsider),{code:'42501'},'Customer administrators cannot read the owner ledger');
 await assert.rejects(report(null),{code:'42501'});await assert.rejects(report(owner,'payment.record'),{code:'22023'});
 await assert.rejects(report(owner,'dashboard',null,{organizationId:client}),{code:'22023'});
 await assert.rejects(report(owner,'dashboard',client),{code:'22023'});
 const roleClient=await pool.connect();try{for(const role of ['anon','authenticated']){
  await roleClient.query('set role '+role);await assert.rejects(roleClient.query("select finance_report($1,'dashboard',null,'{}')",[owner]),{code:'42501'});await roleClient.query('reset role');
 }}finally{roleClient.release();}
 const definition=(await pool.query("select provolatile,prosecdef,proconfig from pg_proc where oid='public.finance_report(uuid,text,uuid,jsonb)'::regprocedure")).rows[0];
 assert.equal(definition.provolatile,'s');assert.equal(definition.prosecdef,true);assert.ok(definition.proconfig.some(x=>x.startsWith('search_path=')));
 // Block the third section after summary/client reads, commit a receipt, then
 // release: the whole report must retain its original snapshot.
 const invoice=(await pool.query("select finance_command($1,'invoice.create',$2,$3) d",[owner,randomUUID(),{reference:'EXACT-CONCURRENT',organizationId:client,projectId:project,amountPaise:100,issuedOn:new Date().toISOString().slice(0,10),dueOn:new Date().toISOString().slice(0,10)}])).rows[0].d;
 const locker=await pool.connect(),reader=await pool.connect();let pending;
 try{
  await locker.query('begin');await locker.query('lock table projects in access exclusive mode');
  const pid=(await reader.query('select pg_backend_pid() pid')).rows[0].pid;
  pending=reader.query("select finance_report($1,'dashboard',null,'{}') d",[owner]).then(value=>({value}),error=>({error}));
  let blocked=false;for(let n=0;n<50;n++){blocked=(await pool.query('select cardinality(pg_blocking_pids($1))>0 blocked',[pid])).rows[0].blocked;if(blocked)break;await new Promise(r=>setTimeout(r,20));}assert.ok(blocked,'Report must wait on the projects section');
  await pool.query("select finance_command($1,'payment.record',$2,$3)",[owner,invoice.id,{idempotencyKey:randomUUID(),reference:'EXACT-CONCURRENT-RECEIPT',amountPaise:1,receivedOn:new Date().toISOString().slice(0,10)}]);
  await locker.query('commit');const result=await pending;if(result.error)throw result.error;const snapshot=result.value.rows[0].d;
  assert.equal(snapshot.summary.collectedPaise,exact);assert.equal(snapshot.monthly.at(-1).collected_paise,exact);
  assert.equal(snapshot.byProject.find(x=>x.project_id===project).collected_paise,exact);
  assert.equal(snapshot.invoices.find(x=>x.id===invoice.id).collected_paise,'0');
  assert.ok(!snapshot.payments.some(x=>x.payment_reference==='EXACT-CONCURRENT-RECEIPT'));
 }finally{await locker.query('rollback');if(pending)await pending;locker.release();reader.release();}
 assert.equal((await report()).summary.collectedPaise,'9008000000000002');
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",[hashToken(raw),owner,hashToken(raw+'-other'),outsider]);
 const app=require('./http-fixture')(pool),server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base+'/api/finance',{headers:{Cookie:'vsph.portal.sid='+raw}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).summary.collectedPaise,'9008000000000002');
  assert.equal((await fetch(base+'/api/finance')).status,401);
  assert.equal((await fetch(base+'/api/finance',{headers:{Cookie:'vsph.portal.sid='+raw+'-other'}})).status,403);
  await pool.query("update profiles set platform_role='user' where id=$1",[owner]);await assert.rejects(report(),{code:'42501'});
  assert.equal((await fetch(base+'/api/finance',{headers:{Cookie:'vsph.portal.sid='+raw}})).status,403);
 }finally{await new Promise(r=>server.close(r));}
};
