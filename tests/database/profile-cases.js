const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const users=[randomUUID(),randomUUID()];
 for(let i=0;i<users.length;i++){
  await pool.query('insert into auth.users values($1)',[users[i]]);await pool.query("insert into profiles(id,full_name,email) values($1,$2,$3)",[users[i],'Profile '+i,'profile-'+users[i]+'@fixture.test']);
  await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",['profile-'+users[i],users[i]]);
 }
 const call=async(user,action,data={},id=null)=>(await pool.query('select account_profile($1,$2,$3,$4) data',[user,action,id,{currentHash:'profile-'+user,...data}])).rows[0].data;
 assert.equal((await call(users[0],'get')).version,0);
 await assert.rejects(call(users[0],'get',{},users[1]),{code:'22023'});
 await assert.rejects(call(users[0],'get',{currentHash:'profile-'+users[1]}),{code:'42501'});
 const values={displayName:'My own <name>',bio:'Profile\nTwo lines',timeZone:'Asia/Kolkata',avatarTone:'blue',version:0};
 for(const extra of [{platformRole:'super_admin'},{email:'other@fixture.test'},{status:'active'},{userId:users[1]}])await assert.rejects(call(users[0],'save',{...values,...extra}),{code:'22023'});
 const attempts=await Promise.allSettled([call(users[0],'save',values),call(users[0],'save',{...values,displayName:'Concurrent'})]);
 assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.equal(attempts.find(a=>a.status==='rejected').reason.code,'40001');
 const saved=await call(users[0],'get');assert.equal(saved.version,1);assert.equal(saved.platformRole,'user');assert.equal(saved.avatarTone,'blue');
 assert.equal((await call(users[1],'get')).bio,'');
 const identity=(await pool.query('select email,status,platform_role from profiles where id=$1',[users[0]])).rows[0];assert.equal(identity.status,'active');assert.equal(identity.platform_role,'user');assert.equal(identity.email,'profile-'+users[0]+'@fixture.test');
 const audit=(await pool.query("select count(*) n from audit_logs where action='account.profile_updated' and actor_user_id=$1",[users[0]])).rows[0];assert.equal(audit.n,'1');
 await pool.query("alter table audit_logs add constraint profile_audit_failure check(action<>'account.profile_updated') not valid");
 try{await assert.rejects(call(users[0],'save',{...values,version:1,displayName:'Must roll back'}),{code:'23514'});}finally{await pool.query('alter table audit_logs drop constraint profile_audit_failure');}
 assert.equal((await call(users[0],'get')).displayName,saved.displayName);assert.equal((await call(users[0],'get')).version,1);
 for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('set role '+role);await assert.rejects(c.query('select * from account_profile_preferences'),{code:'42501'});await assert.rejects(c.query("select account_profile($1,'get',null,'{}')",[users[0]]),{code:'42501'});}finally{await c.query('reset role');c.release();}}
 await pool.query("update portal_sessions set expires_at=now()-interval '1 second' where user_id=$1",[users[0]]);await assert.rejects(call(users[0],'get'),{code:'42501'});
 await pool.query("update profiles set status='disabled' where id=$1",[users[1]]);await assert.rejects(call(users[1],'get'),{code:'42501'});
};
