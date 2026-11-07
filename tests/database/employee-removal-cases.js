const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');

module.exports=async pool=>{
 const owner='71717171-7171-4171-8171-717171717171';
 const hr=randomUUID(),email='removal-hr-'+randomUUID()+'@fixture.test';
 await pool.query('insert into auth.users(id) values($1)',[hr]);
 await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Removal HR',$2,'user')",[hr,email]);
 const create=async(actor,address,name='Removal employee')=>
  (await pool.query("select internal_employee_command($1,'create',$2,$3) data",
   [actor,randomUUID(),{fullName:name,email:address,department:'Engineering',jobTitle:'Developer',employmentType:'full_time',startDate:'2026-11-06'}])).rows[0].data;
 const update=async(id,version,status='active')=>
  (await pool.query("select internal_employee_command($1,'update',$2,$3) data",
   [owner,id,{fullName:'Removal HR',department:'Engineering',jobTitle:'Developer',employmentType:'full_time',
    startDate:'2026-11-06',status,version,confirmed:true}])).rows[0].data;
 const call=async(actor,action,id=null,data={})=>
  (await pool.query('select internal_employee_removal($1,$2,$3,$4) data',[actor,action,id,data])).rows[0].data;
 const manager=await create(owner,email,'Removal HR');
 await update(manager.id,1);
 await require('./employee-link-fixture')(pool,owner,hr,manager.id);
 await pool.query("select internal_employee_command($1,'grant_hr',$2,$3)",[owner,manager.id,{version:2,confirmed:true}]);
 const workerEmail='removed-worker-'+randomUUID()+'@fixture.test',worker=await create(hr,workerEmail,'Sample Worker');
 const workerUser=randomUUID();
 await pool.query('insert into auth.users(id) values($1)',[workerUser]);
 await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Sample Worker',$2,'user')",[workerUser,workerEmail]);
 await require('./employee-link-fixture')(pool,owner,workerUser,worker.id);
 assert.equal((await pool.query('select status from internal_employee_identity_links where employee_id=$1',[worker.id])).rows[0].status,'linked');
 await assert.rejects(call(hr,'history'),{code:'42501'});
 await assert.rejects(call(workerUser,'remove',worker.id,{version:1,confirmed:true,reason:'Employment ended'}),{code:'42501'});
 await assert.rejects(call(hr,'remove',manager.id,{version:3,confirmed:true,reason:'Employment ended'}),{code:'42501'});
 const ownerRoster=await create(owner,'staff-owner@fixture.test','Protected owner');
 await assert.rejects(call(hr,'remove',ownerRoster.id,{version:1,confirmed:true,reason:'Employment ended'}),{code:'42501'});
 await assert.rejects(call(owner,'remove',ownerRoster.id,{version:1,confirmed:true,reason:'Employment ended'}),{code:'42501'});
 await assert.rejects(call(hr,'remove',worker.id,{version:1,confirmed:true,reason:'x'}),{code:'22023'});
 const removed=await call(hr,'remove',worker.id,{version:1,confirmed:true,reason:'Employment contract ended'});
 assert.equal(removed.removed,true);
 assert.equal((await pool.query('select status from internal_employee_identity_links where employee_id=$1',[worker.id])).rows[0].status,'revoked');
 assert.equal((await pool.query('select status from profiles where id=$1',[workerUser])).rows[0].status,'active','Unrelated portal identity stays separate');
 assert.equal((await pool.query('select status from internal_employees where id=$1',[worker.id])).rows[0].status,'inactive');
 assert.equal((await pool.query('select count(*) from internal_employees where id=$1 and removed_at is not null',[worker.id])).rows[0].count,'1');
 const directory=(await pool.query("select internal_employee_command($1,'list',null,'{}') data",[hr])).rows[0].data;
 assert.ok(!directory.employees.some(e=>e.id===worker.id),'Removed identity hidden from HR directory');
 const history=(await call(owner,'history')).employees;
 const event=history.find(e=>e.id===worker.id);
 assert.equal(event.removal_reason,'Employment contract ended');
 assert.equal(event.removed_by,hr);
 assert.equal(event.removed_by_name,'Removal HR');
 assert.ok(event.removed_at);
 assert.equal((await pool.query("select count(*) from audit_logs where action='employee.removed' and target_id=$1",[worker.id])).rows[0].count,'1');
 await assert.rejects(call(hr,'remove',worker.id,{version:2,confirmed:true,reason:'Employment contract ended'}),{code:'P0002'});
 await assert.rejects(pool.query("select internal_employee_command($1,'update',$2,$3)",[owner,worker.id,{
  fullName:'Sample Worker',department:'Engineering',jobTitle:'Developer',employmentType:'full_time',
  startDate:'2026-11-06',status:'active',version:2,confirmed:true}]),{code:'P0002'});
 await call(owner,'remove',manager.id,{version:3,confirmed:true,reason:'Manager employment ended'});
 await assert.rejects(pool.query("select internal_employee_command($1,'access',null,'{}')",[hr]),{code:'42501'});
};
