const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const owner=randomUUID(),session='setup-'+randomUUID();await pool.query('insert into auth.users values($1)',[owner]);await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Setup owner',$2,'super_admin')",[owner,owner+'@test.example']);await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[session,owner]);
 const users=[],passwords=new Map();let failOnce=true;
 const auth={admin:{listUsers:async()=>({data:{users},error:null}),createUser:async input=>{
  if(input.email.endsWith('-employee@example.test')&&failOnce){failOnce=false;return {error:Error('Synthetic provider outage')};}
  const user={id:randomUUID(),email:input.email,app_metadata:input.app_metadata};await pool.query('insert into auth.users values($1)',[user.id]);users.push(user);passwords.set(user.id,input.password);return {data:{user},error:null};
 }}};
 require('./http-fixture')(pool,auth);const database=require('../../db').db();
 const {setupRoleAccounts}=require('../../services/role-test-accounts');
 const verify=async(input,{expectedUserId})=>{assert.equal(passwords.get(expectedUserId),input.password);return {user:{id:expectedUserId},assurance:'aal1'};};
 const state={runId:randomUUID(),startDate:'2026-11-01',passwords:{hr:'hr-private-password-32-characters',employee:'employee-private-password-32-chars',customer:'customer-private-password-32-chars'}};
 const args={database,ownerId:owner,ownerSessionHash:session,state,verify};
 await assert.rejects(setupRoleAccounts(args),/Auth creation incomplete/);assert.equal(users.length,1);
 const accounts=await setupRoleAccounts(args);assert.equal(users.length,3);assert.equal(accounts.owner.email,owner+'@test.example');
 const counts=async()=>Object.fromEntries(await Promise.all(['profiles','internal_employees','internal_hr_managers','internal_employee_link_requests','internal_employee_identity_links','organizations','organization_memberships','audit_logs','portal_sessions'].map(async t=>[t,(await pool.query('select count(*)::int n from '+t)).rows[0].n])));
 const before=await counts();await setupRoleAccounts(args);assert.deepEqual(await counts(),before,'retry must not duplicate accounts, links, grants, organizations or audits');
 const authority=async id=>(await pool.query('select internal_workforce_authority($1) value',[id])).rows[0].value;
 assert.equal(await authority(accounts.hr.id),'hr');assert.equal(await authority(accounts.employee.id),null);assert.equal(await authority(accounts.customer.id),null);
 assert.equal((await pool.query('select count(*)::int n from organization_memberships where user_id=$1 and organization_id<>$2',[accounts.customer.id,accounts.organizationId])).rows[0].n,0);
 assert.equal((await pool.query('select count(*)::int n from user_app_roles where user_id=any($1::uuid[])',[users.map(u=>u.id)])).rows[0].n,0);
 await assert.rejects(setupRoleAccounts({...args,ownerId:accounts.employee.id}),/current platform owner/);
 const saved=users[0].app_metadata;users[0].app_metadata={};await assert.rejects(setupRoleAccounts(args),/foreign identity/);users[0].app_metadata=saved;
 await assert.rejects(setupRoleAccounts({...args,verify:async()=>{throw Error('Verification outage');}}),/Verification outage/);
};
