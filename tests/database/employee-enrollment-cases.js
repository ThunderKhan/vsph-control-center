const assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto'),{once}=require('node:events'),{hashToken}=require('../../tokens');
module.exports=async pool=>{
 const owner=randomUUID(),outsider=randomUUID(),raw='enroll-'+randomUUID(),otherRaw='enroll-other-'+randomUUID();
 for(const [id,role,token] of [[owner,'super_admin',raw],[outsider,'user',otherRaw]]){
  await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Enrollment operator',$2,$3)",[id,id+'@fixture.test',role]);await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hashToken(token),id]);
 }
 const roster=async(email=randomUUID()+'@fixture.test')=>(await pool.query("select internal_employee_command($1,'create',$2,$3) d",[owner,randomUUID(),{fullName:'New colleague',email,department:'Engineering',jobTitle:'Developer',employmentType:'intern',startDate:'2026-11-06'}])).rows[0].d;
 const rpc=async(actor,action,id,data={})=>(await pool.query('select internal_employee_enrollment($1,$2,$3,$4) d',[actor,action,id,data])).rows[0].d;
 const manage={currentHash:hashToken(raw),confirmed:true,rosterVersion:1};
 const provider=require('../fixtures/employee-enrollment-provider')(pool,require('../fixtures/identity-provider')(async email=>(await pool.query('select id,email from profiles where email=$1',[email])).rows[0]));
 const server=require('./http-fixture')(pool,provider.auth,provider.factory).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const send=(path,body,token=raw,headers={})=>fetch(base+'/api/employee-enrollment'+path,{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(token?{Cookie:'vsph.portal.sid='+token}:{}),...headers},body:JSON.stringify(body)});
 const start=async e=>{const res=await send('/employees/'+e.id,{rosterVersion:1,confirmed:true},raw,{'Idempotency-Key':randomUUID()});assert.equal(res.status,200,JSON.stringify(await res.clone().json()));const d=await res.json(),p=new URLSearchParams(new URL(d.url).hash.slice(1));assert.equal(d.delivery,'private_manual_handoff');return {id:d.id,token:p.get('token')};};
 try{
  const employee=await roster();assert.equal((await send('/employees/'+employee.id,{rosterVersion:1,confirmed:true},null,{'Idempotency-Key':randomUUID()})).status,401);
  assert.equal((await send('/employees/'+employee.id,{rosterVersion:1,confirmed:true},otherRaw,{'Idempotency-Key':randomUUID()})).status,403);
  const invite=await start(employee),row=(await pool.query('select * from internal_employee_enrollments where id=$1',[invite.id])).rows[0];
  assert.equal((await pool.query('select status from profiles where id=$1',[row.auth_user_id])).rows[0].status,'disabled');
  assert.equal((await send('/inspect',invite,null)).status,200);
  await assert.rejects(pool.query("update profiles set status='active' where id=$1",[row.auth_user_id]),{code:'42501'});
  provider.fail.weakPassword=true;assert.equal((await send('/accept',{...invite,password:'provider-rejected-password',confirmed:true},null)).status,400);provider.fail.weakPassword=false;
  assert.equal((await pool.query('select state from internal_employee_enrollments where id=$1',[invite.id])).rows[0].state,'ready');
  assert.equal((await send('/inspect',{...invite,token:randomBytes(32).toString('base64url')},null)).status,403);
  assert.equal((await send('/accept',{...invite,password:'short',confirmed:true},null)).status,400);
  assert.equal((await send('/accept',{...invite,password:'employee-password-2026',confirmed:true,platformRole:'super_admin'},null)).status,400);
  // A native second connection and durable reservation allow only one external password write.
  const before=provider.events.filter(e=>e==='password').length;
  const concurrent=await Promise.all([1,2].map(()=>send('/accept',{...invite,password:'employee-password-2026',confirmed:true},null)));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal(provider.events.filter(e=>e==='password').length,before+1);
  assert.equal((await send('/accept',{...invite,password:'replay-password-2026',confirmed:true},null)).status,403);
  const logged=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({email:row.email,password:'employee-password-2026'})});assert.equal(logged.status,200);assert.equal((await logged.json()).user.platformRole,'user');
  assert.equal((await pool.query('select status from profiles where id=$1',[row.auth_user_id])).rows[0].status,'active');
  assert.equal((await pool.query('select count(*) from internal_employee_identity_links where user_id=$1 and status=\'linked\'',[row.auth_user_id])).rows[0].count,'1');
  for(const t of ['internal_hr_managers','organization_memberships','user_app_roles','project_memberships'])assert.equal((await pool.query('select count(*) from '+t+' where user_id=$1',[row.auth_user_id])).rows[0].count,'0');
  await assert.rejects(rpc(owner,'renew',invite.id,{...manage,version:6,tokenHash:'a'.repeat(64)}),{code:'42501'});
  const existing=await roster(outsider+'@fixture.test');assert.equal((await send('/employees/'+existing.id,{rosterVersion:1,confirmed:true},raw,{'Idempotency-Key':randomUUID()})).status,403,'Existing account passwords must never be enrolled');
  const retry=await roster();provider.fail.create=true;assert.equal((await send('/employees/'+retry.id,{rosterVersion:1,confirmed:true},raw,{'Idempotency-Key':randomUUID()})).status,503);provider.fail.create=false;
  let r=(await pool.query('select * from internal_employee_enrollments where employee_id=$1',[retry.id])).rows[0];const planned=r.auth_user_id;
  let renewed=await send('/'+r.id+'/renew',{rosterVersion:1,version:r.version,confirmed:true});assert.equal(renewed.status,200);assert.equal((await pool.query('select auth_user_id from internal_employee_enrollments where id=$1',[r.id])).rows[0].auth_user_id,planned);
  const renewedData=await renewed.json(),proof={id:r.id,token:new URLSearchParams(new URL(renewedData.url).hash.slice(1)).get('token')};
  provider.fail.password=true;const failure=await send('/accept',{...proof,password:'a-new-password-2026',confirmed:true},null);assert.equal(failure.status,503);assert.ok(!(await failure.text()).includes('private password'));provider.fail.password=false;
  r=(await pool.query('select * from internal_employee_enrollments where id=$1',[r.id])).rows[0];assert.equal(r.state,'recovery_required');assert.equal((await pool.query("select count(*) from audit_logs where action='employee.enrollment_failed' and target_id=$1",[retry.id])).rows[0].count,'1');assert.equal((await pool.query('select status from profiles where id=$1',[planned])).rows[0].status,'disabled');assert.equal((await send('/'+r.id+'/renew',{rosterVersion:1,version:r.version,confirmed:true})).status,403);
  const cancellationRace=await start(await roster()),cancellationRow=(await pool.query('select * from internal_employee_enrollments where id=$1',[cancellationRace.id])).rows[0];
  let entered,release;const reached=new Promise(r=>{entered=r;}),paused=new Promise(r=>{release=r;});provider.fail.beforePassword=async()=>{entered();await paused;};
  const accepting=send('/accept',{...cancellationRace,password:'cancelled-password-2026',confirmed:true},null);await reached;
  assert.equal((await rpc(owner,'cancel',cancellationRace.id,{...manage,version:cancellationRow.version+1})).saved,true);release();assert.equal((await accepting).status,503);delete provider.fail.beforePassword;
  assert.equal((await pool.query('select status from profiles where id=$1',[cancellationRow.auth_user_id])).rows[0].status,'disabled');assert.equal((await pool.query('select count(*) from internal_employee_identity_links where user_id=$1',[cancellationRow.auth_user_id])).rows[0].count,'0');
  const hr=randomUUID(),hrRaw='enrollment-hr-'+randomUUID();await pool.query('insert into auth.users values($1)',[hr]);await pool.query("insert into profiles(id,full_name,email) values($1,'Enrollment HR',$2)",[hr,hr+'@fixture.test']);const hrRoster=await roster(hr+'@fixture.test');await pool.query("update internal_employees set status='active' where id=$1",[hrRoster.id]);await require('./employee-link-fixture')(pool,owner,hr,hrRoster.id);await pool.query("select internal_employee_command($1,'grant_hr',$2,$3)",[owner,hrRoster.id,{version:1,confirmed:true}]);await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hashToken(hrRaw),hr]);
  const hrTarget=await roster(),hrIssued=await send('/employees/'+hrTarget.id,{rosterVersion:1,confirmed:true},hrRaw,{'Idempotency-Key':randomUUID()});assert.equal(hrIssued.status,200);const hrData=await hrIssued.json(),hrProof={id:hrData.id,token:new URLSearchParams(new URL(hrData.url).hash.slice(1)).get('token')};
  await assert.rejects(rpc(hr,'start',hrRoster.id,{currentHash:hashToken(hrRaw),rosterVersion:2,confirmed:true,key:randomUUID(),tokenHash:'a'.repeat(64)}),{code:'42501'});await pool.query("select internal_employee_command($1,'revoke_hr',$2,$3)",[owner,hrRoster.id,{version:2,confirmed:true}]);await assert.rejects(rpc(null,'inspect',hrProof.id,{tokenHash:require('../../services/employee-enrollment').hash(hrProof.token)}),{code:'42501'});
  const expired=await start(await roster());await pool.query("update internal_employee_enrollments set created_at=now()-interval '10 days',expires_at=now()-interval '1 day' where id=$1",[expired.id]);assert.equal((await send('/inspect',expired,null)).status,403);
  const disabled=await start(await roster()),disabledRow=(await pool.query('select * from internal_employee_enrollments where id=$1',[disabled.id])).rows[0];await pool.query("select set_profile_status($1,$2,'disabled')",[owner,disabledRow.auth_user_id]);assert.equal((await send('/inspect',disabled,null)).status,403);assert.equal((await send('/'+disabled.id+'/renew',{rosterVersion:1,version:disabledRow.version+1,confirmed:true})).status,403);
  const rotated=await start(await roster()),rotatedRow=(await pool.query('select * from internal_employee_enrollments where id=$1',[rotated.id])).rows[0];assert.equal((await send('/'+rotated.id+'/renew',{rosterVersion:1,version:rotatedRow.version,confirmed:true})).status,200);assert.equal((await send('/inspect',rotated,null)).status,403,'Reissue invalidates the old capability');
  const cancelled=await start(await roster());const cancelledRow=(await pool.query('select * from internal_employee_enrollments where id=$1',[cancelled.id])).rows[0];assert.equal((await send('/'+cancelled.id+'/cancel',{rosterVersion:1,version:cancelledRow.version,confirmed:true})).status,200);assert.equal((await send('/inspect',cancelled,null)).status,403);
  const suspendedEmployee=await roster(),suspended=await start(suspendedEmployee);await pool.query("update internal_employees set status='inactive' where id=$1",[suspendedEmployee.id]);assert.equal((await send('/inspect',suspended,null)).status,403);
  const staleEmployee=await roster(),stale=await start(staleEmployee);await pool.query('update internal_employees set version=version+1 where id=$1',[staleEmployee.id]);assert.equal((await send('/inspect',stale,null)).status,403);
  const revoked=await start(await roster());await pool.query('delete from portal_sessions where token_hash=$1',[hashToken(raw)]);assert.equal((await send('/employees/'+employee.id,{rosterVersion:1,confirmed:true},raw,{'Idempotency-Key':randomUUID()})).status,401);
  // An invitation outlives the issuer's individual browser session, but not authority.
  await pool.query("update profiles set status='disabled' where id=$1",[owner]);assert.equal((await send('/inspect',revoked,null)).status,403);
  for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('set role '+role);await assert.rejects(c.query('select * from internal_employee_enrollments'),{code:'42501'});await assert.rejects(c.query("select internal_employee_enrollment(null,'inspect',$1,$2)",[invite.id,{tokenHash:require('../../services/employee-enrollment').hash(invite.token)}]),{code:'42501'});}finally{await c.query('reset role');c.release();}}
  await assert.rejects(rpc(outsider,'review',employee.id,{currentHash:hashToken(otherRaw)}),{code:'42501'});
 }finally{await new Promise(r=>server.close(r));}
};
