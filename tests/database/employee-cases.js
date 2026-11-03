const assert = require('node:assert/strict');
const crypto = require('node:crypto');
module.exports = async pool => {
 const owner='71717171-7171-4171-8171-717171717171';
 const hr='72727272-7272-4272-8272-727272727272';
 const outsider='73737373-7373-4373-8373-737373737373';
 for(const [id,name,email,role] of [
  [owner,'Internal Owner','staff-owner@fixture.test','super_admin'],
  [hr,'Internal HR','staff-hr@fixture.test','user'],
  [outsider,'Outside User','staff-outsider@fixture.test','user']
 ]){
  await pool.query('insert into auth.users(id) values($1)',[id]);
  await pool.query('insert into profiles(id,full_name,email,platform_role) values($1,$2,$3,$4)',[id,name,email,role]);
 }
 const cmd=async(who,action,id=null,data={})=>
  (await pool.query('select public.internal_employee_command($1,$2,$3,$4) data',[who,action,id,data])).rows[0].data;
 const sample=(email,fullName='Internal Colleague')=>({
  fullName,email,department:'Engineering',jobTitle:'Software Developer',
  employmentType:'full_time',startDate:'2026-11-03'
 });
 const ownerEmployeeKey=crypto.randomUUID();
 const initial=await cmd(owner,'create',ownerEmployeeKey,sample('staff-hr@fixture.test','Internal HR'));
 assert.equal(initial.status,'onboarding');
 assert.equal(initial.replayed,false);
 assert.equal((await cmd(owner,'create',ownerEmployeeKey,sample('staff-hr@fixture.test','Internal HR'))).replayed,true);
 await assert.rejects(cmd(owner,'create',ownerEmployeeKey,sample('staff-hr@fixture.test','Changed details')),{code:'23505'});
 await assert.rejects(cmd(owner,'create',crypto.randomUUID(),sample('staff-hr@fixture.test')),{code:'23505'});
 await assert.rejects(cmd(outsider,'access'),{code:'42501'});
 await assert.rejects(cmd(hr,'list'),{code:'42501'});
 await assert.rejects(cmd(hr,'create',crypto.randomUUID(),sample('injected@fixture.test')),{code:'42501'});
 await assert.rejects(cmd(owner,'grant_hr',initial.id,{version:1,confirmed:true}),{code:'42501'});
 const edit=(version,status='active')=>({...sample('staff-hr@fixture.test','Internal HR'),
   email:undefined,version,confirmed:true,status});
 delete edit(1).email;
 let changed=await cmd(owner,'update',initial.id,edit(1));
 assert.equal(changed.version,2);
 await assert.rejects(cmd(owner,'update',initial.id,edit(1)),{code:'40001'});
 await assert.rejects(cmd(hr,'grant_hr',initial.id,{version:2,confirmed:true}),{code:'42501'});
 await require('./employee-link-fixture')(pool,owner,hr,initial.id);
 const granted=await cmd(owner,'grant_hr',initial.id,{version:2,confirmed:true});
 assert.equal(granted.version,3);
 assert.equal((await cmd(hr,'access')).role,'hr');
 assert.equal((await cmd(owner,'access')).canManageHr,true);
 assert.equal((await cmd(hr,'list')).canManageHr,false);
 const staffKey=crypto.randomUUID();
 const colleague=await cmd(hr,'create',staffKey,sample('unlinked-colleague@fixture.test','Example Employee'));
 assert.equal(colleague.status,'onboarding');
 assert.equal((await pool.query("select count(*) from profiles where email='unlinked-colleague@fixture.test'")).rows[0].count,'0','Roster creation must not create login users');
 await assert.rejects(cmd(hr,'update',initial.id,edit(3)),{code:'42501'},'HR cannot edit an HR manager record');
 await assert.rejects(cmd(hr,'revoke_hr',initial.id,{version:3,confirmed:true}),{code:'42501'});
 await assert.rejects(cmd(hr,'grant_hr',colleague.id,{version:1,confirmed:true}),{code:'42501'});
 const detail=await cmd(hr,'list');
 assert.equal(detail.counts.total,2);
 assert.equal(detail.counts.active,1);
 assert.equal(detail.counts.onboarding,1);
 assert.equal(detail.counts.hrManagers,1);
 assert.equal(detail.hrManagers.length,0,'HR must not see owner-only HR manager directory');
 const ownerRows=await cmd(owner,'list',null,{search:'unlinked'});
 assert.equal(ownerRows.employees.length,1);
 assert.equal(ownerRows.employees[0].email,'unlinked-colleague@fixture.test');
 assert.ok(!JSON.stringify(ownerRows).includes('request_hash'));
 // HR can update an ordinary employee, but stale/concurrent writes cannot win.
 const updateBody=(version,status='active')=>({fullName:'Example Employee',department:'Engineering',
  jobTitle:'Software Developer',employmentType:'full_time',startDate:'2026-11-03',status,version,confirmed:true});
 const results=await Promise.allSettled([1,2].map(()=>cmd(hr,'update',colleague.id,updateBody(1))));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'40001');
 assert.equal((await cmd(owner,'list')).counts.active,2);
 // Persisted roster states do not confer tenant or product membership.
 assert.equal((await pool.query('select count(*) from organization_memberships where user_id=$1',[hr])).rows[0].count,'0');
 const c=await pool.connect();
 try{
  for(const role of ['anon','authenticated']){
   await c.query('set role '+role);
   await assert.rejects(c.query('select * from public.internal_employees'),{code:'42501'});
   await assert.rejects(c.query('select * from public.internal_hr_managers'),{code:'42501'});
   await assert.rejects(c.query("select public.internal_employee_command($1,'list',null,'{}')",[hr]),{code:'42501'});
   await c.query('reset role');
  }
 }finally{c.release();}
 // An audit outage must rollback the employee edit and its optimistic version.
 await pool.query("create function public.staff_reject_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic staff audit outage';end$$;");
 await pool.query('create trigger staff_reject_audit before insert on public.audit_logs for each row execute function public.staff_reject_audit()');
 try{
  await assert.rejects(cmd(hr,'update',colleague.id,updateBody(2,'on_leave')),{code:'P0001'});
  assert.equal((await pool.query('select version from internal_employees where id=$1',[colleague.id])).rows[0].version,2);
 }finally{
  await pool.query('drop trigger staff_reject_audit on public.audit_logs');
  await pool.query('drop function public.staff_reject_audit()');
 }
 const revoked=await cmd(owner,'revoke_hr',initial.id,{version:3,confirmed:true});
 assert.equal(revoked.version,4);
 await assert.rejects(cmd(hr,'list'),{code:'42501'});
 assert.equal((await cmd(owner,'list')).counts.hrManagers,0);
 const regranted=await cmd(owner,'grant_hr',initial.id,{version:4,confirmed:true});
 assert.equal(regranted.version,5);
 assert.equal((await cmd(hr,'access')).role,'hr');
 // A disabled portal identity must lose its HR grant permanently, even if
 // platform identity is reactivated later. Owner reapproval is mandatory.
 await pool.query("update profiles set status='disabled' where id=$1",[hr]);
 assert.equal((await cmd(owner,'list')).counts.hrManagers,0);
 await pool.query("update profiles set status='active' where id=$1",[hr]);
 await assert.rejects(cmd(hr,'access'),{code:'42501'});
 await require('./employee-link-fixture')(pool,owner,hr,initial.id);
 const approvedAgain=await cmd(owner,'grant_hr',initial.id,{version:5,confirmed:true});
 assert.equal(approvedAgain.version,6);
 assert.equal((await cmd(hr,'access')).role,'hr');
 await cmd(owner,'update',initial.id,edit(6,'inactive'));
 assert.equal((await cmd(owner,'list')).counts.hrManagers,0);
 await assert.rejects(cmd(hr,'list'),{code:'42501'});
};
