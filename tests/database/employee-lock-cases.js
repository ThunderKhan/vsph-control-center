const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const owner=randomUUID(),hr=randomUUID();
 for(const [id,email,role] of [[owner,'lock-owner','super_admin'],[hr,'lock-hr','user']]){
  await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,$2,$2||'@fixture.test',$3)",[id,email,role]);
 }
 const args={fullName:'Lock HR',email:'lock-hr@fixture.test',department:'Operations',jobTitle:'HR manager',employmentType:'full_time',startDate:'2026-11-03'};
 const sql='select internal_employee_command($1,$2,$3,$4) data';
 const call=async(who,action,id=null,data={})=>(await pool.query(sql,[who,action,id,data])).rows[0].data;
 const employee=await call(owner,'create',randomUUID(),args),edit={...args,status:'active',version:1,confirmed:true};delete edit.email;
 await call(owner,'update',employee.id,edit);await call(owner,'grant_hr',employee.id,{version:2,confirmed:true});
 // Hold the same roster lock an owner mutation takes, pause HR behind it,
 // then revoke. HR must not hold a grant lock while waiting for that roster.
 // The historical function's grant -> roster order deadlocks this schedule.
 // Prove the historical order from the retained implementation, without
 // waiting for PostgreSQL's deadlock victim selection. NOWAIT detects that
 // HR holds its grant while blocked by the owner's roster lock.
 const legacyA=await pool.connect(),legacyB=await pool.connect();let historical;
 try{
  await legacyA.query("begin;set local statement_timeout='4s'");await legacyB.query("begin;set local statement_timeout='4s'");
  await legacyA.query('select 1 from internal_employees where id=$1 for update',[employee.id]);
  const pid=(await legacyB.query('select pg_backend_pid() pid')).rows[0].pid;
  historical=legacyB.query('select internal_employee_core_command($1,$2,$3,$4)',[hr,'create',randomUUID(),{...args,email:'rolled-back-historical-lock@fixture.test'}]).then(value=>({value}),error=>({error}));
  let blocked=false;
  for(let attempt=0;attempt<60;attempt++){
   blocked=(await pool.query('select cardinality(pg_blocking_pids($1))>0 blocked',[pid])).rows[0].blocked;
   if(blocked)break;await new Promise(r=>setTimeout(r,25));
  }
  assert.ok(blocked);
  await assert.rejects(legacyA.query('select 1 from internal_hr_managers where employee_id=$1 for update nowait',[employee.id]),{code:'55P03'});
  await legacyA.query('rollback');assert.equal((await historical).error,undefined);await legacyB.query('rollback');
 }finally{await legacyA.query('rollback');await legacyB.query('rollback');if(historical)await historical;legacyA.release();legacyB.release();}
 assert.equal((await pool.query("select count(*) from internal_employees where email='rolled-back-historical-lock@fixture.test'")).rows[0].count,'0');
 const a=await pool.connect(),b=await pool.connect();let pending;
 try{
  await a.query("begin;set local statement_timeout='4s'");await b.query("begin;set local statement_timeout='4s'");
  await a.query('select 1 from internal_employees where id=$1 for update',[employee.id]);
  const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
  pending=b.query(sql,[hr,'create',randomUUID(),{...args,email:'denied-after-hr-revocation@fixture.test'}]).then(value=>({value}),error=>({error}));
  let blocked=false;
  for(let attempt=0;attempt<60;attempt++){
   blocked=(await pool.query('select cardinality(pg_blocking_pids($1))>0 blocked',[pid])).rows[0].blocked;
   if(blocked)break;await new Promise(r=>setTimeout(r,25));
  }
  assert.ok(blocked,'HR command must be waiting behind the roster lock');
  await a.query(sql,[owner,'revoke_hr',employee.id,{version:3,confirmed:true}]);await a.query('commit');
  const outcome=await pending;assert.equal(outcome.error?.code,'42501','Revoked HR may not create after waiting');await b.query('rollback');
  assert.equal((await pool.query("select count(*) from internal_employees where email='denied-after-hr-revocation@fixture.test'")).rows[0].count,'0');
  assert.equal((await pool.query('select count(*) from internal_hr_managers where employee_id=$1',[employee.id])).rows[0].count,'0');
 }finally{await a.query('rollback');await b.query('rollback');if(pending)await pending;a.release();b.release();}
 // No direct bypass of ordered locks, including for the service role.
 for(const role of ['anon','authenticated','service_role']){
  const c=await pool.connect();try{await c.query('set role '+role);await assert.rejects(c.query('select internal_employee_core_command($1,\'access\',null,\'{}\')',[hr]),{code:'42501'});}finally{await c.query('reset role');c.release();}
 }
 for(const version of [2147483648,0,1.5,'3',null])await assert.rejects(call(owner,'update',employee.id,{...edit,version}),{code:'22023'});
 await assert.rejects(call(hr,'grant_hr',employee.id,{version:4,confirmed:true}),{code:'42501'});
 assert.equal((await call(owner,'access')).role,'owner');
};
