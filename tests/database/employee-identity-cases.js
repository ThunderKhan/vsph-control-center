const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{once}=require('node:events'),{hashToken}=require('../../tokens');
module.exports=async pool=>{
 const owner=randomUUID(),hr=randomUUID(),candidate=randomUUID(),outsider=randomUUID(),tokens=new Map();
 const emails=new Map();
 for(const [id,role] of [[owner,'super_admin'],[hr,'user'],[candidate,'user'],[outsider,'user']]){
  const email=id+'@fixture.test';emails.set(id,email);tokens.set(id,hashToken(randomUUID()));
  await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Link fixture',$2,$3)",[id,email,role]);
  await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[tokens.get(id),id]);
 }
 const roster=async(user)=>(await pool.query("select internal_employee_command($1,'create',$2,$3) d",[owner,randomUUID(),{fullName:'Consenting colleague',email:emails.get(user),department:'Engineering',jobTitle:'Developer',employmentType:'intern',startDate:'2026-11-03'}])).rows[0].d;
 const call=async(actor,action,id=null,data={})=>(await pool.query('select internal_employee_identity($1,$2,$3,$4) d',[actor,action,id,{...data,currentHash:tokens.get(actor)}])).rows[0].d;
 const person=await roster(candidate),requestData={rosterVersion:1,confirmed:true,key:randomUUID()};
 const request=await call(owner,'request',person.id,requestData);assert.equal((await call(owner,'request',person.id,requestData)).replayed,true);
 assert.equal((await pool.query("select count(*) from audit_logs where action='employee.identity_link_requested' and target_id=$1",[person.id])).rows[0].count,'1');
 await assert.rejects(call(outsider,'manage',person.id),{code:'42501'});await assert.rejects(call(outsider,'request',person.id,{...requestData,key:randomUUID()}),{code:'42501'});
 assert.equal((await call(outsider,'inbox')).requests.length,0);assert.equal((await call(candidate,'inbox')).requests.length,1);
 const proof={rosterVersion:1,requestVersion:1,confirmed:true,assurance:'aal1',verifiedAt:new Date().toISOString()};
 await assert.rejects(call(outsider,'accept',request.id,proof),{code:'42501'});
 await assert.rejects(call(candidate,'accept',request.id,{...proof,assurance:null}),{code:'42501'});
 await assert.rejects(call(candidate,'accept',request.id,{...proof,verifiedAt:new Date(Date.now()-60000).toISOString()}),{code:'42501'});
 await assert.rejects(call(candidate,'accept',request.id,{...proof,confirmed:false}),{code:'42501'});
 await pool.query("update internal_employee_link_requests set created_at=now()-interval '8 days',expires_at=now()-interval '1 second' where id=$1",[request.id]);
 assert.equal((await call(candidate,'inbox')).requests.length,0);assert.equal((await call(owner,'manage',person.id)).requests[0].state,'expired');
 await assert.rejects(call(candidate,'accept',request.id,proof),{code:'42501'});
 await call(owner,'renew',person.id,{rosterVersion:1,requestVersion:1,requestId:request.id,confirmed:true});
 await assert.rejects(call(candidate,'accept',request.id,proof),{code:'40001'});
 const renewed={...proof,requestVersion:2,verifiedAt:new Date().toISOString()};
 await pool.query("create function link_fail_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic consent audit outage';end$$;create trigger link_fail_audit before insert on audit_logs for each row execute function link_fail_audit()");
 try{await assert.rejects(call(candidate,'accept',request.id,renewed),{code:'P0001'});assert.equal((await pool.query('select count(*) from internal_employee_identity_links where employee_id=$1',[person.id])).rows[0].count,'0');assert.equal((await pool.query('select state from internal_employee_link_requests where id=$1',[request.id])).rows[0].state,'pending');}
 finally{await pool.query('drop trigger link_fail_audit on audit_logs;drop function link_fail_audit()');}
 const outcomes=await Promise.allSettled([1,2].map(()=>call(candidate,'accept',request.id,renewed)));assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'40001');
 assert.equal((await call(candidate,'inbox')).employment.length,1);assert.equal((await call(outsider,'inbox')).employment.length,0);
 assert.equal((await call(candidate,'accept',request.id,{...renewed,requestVersion:3})).replayed,true);
 for(const table of ['organization_memberships','user_app_roles','project_memberships','internal_hr_managers'])assert.equal((await pool.query('select count(*) from '+table+' where user_id=$1',[candidate])).rows[0].count,'0');
 // Explicitly assigned customer/product/project access is independent and
 // must survive employee link revocation/offboarding.
 const org=randomUUID(),app=(await pool.query("select id from applications where code='MUSIC'")).rows[0].id;
 await pool.query("insert into organizations(id,name,slug) values($1,'Linked account customer',$2)",[org,org]);
 await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'admin')",[org,candidate]);
 await pool.query("insert into subscriptions(organization_id,application_id,status) values($1,$2,'active')",[org,app]);
 await pool.query('insert into organization_app_access(organization_id,application_id) values($1,$2)',[org,app]);
 await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,'viewer')",[org,candidate,app]);
 const project=(await pool.query("select project_command($1,'create',null,$2) d",[owner,{key:'LINK-'+randomUUID().slice(0,8).toUpperCase(),name:'Explicit staff project',kind:'internal'}])).rows[0].d;
 await pool.query("select project_command($1,'member.save',$2,$3)",[owner,project.id,{version:1,userId:candidate,role:'contributor',status:'active'}]);
 await call(owner,'revoke',person.id,{rosterVersion:1,linkVersion:1,confirmed:true});assert.equal((await call(candidate,'inbox')).employment.length,0);
 await assert.rejects(call(candidate,'accept',request.id,{...renewed,requestVersion:4}),{code:'42501'});
 // Competing requests produce one pending purpose, not duplicate invitations.
 const race=await Promise.allSettled([1,2].map(()=>call(owner,'request',person.id,{rosterVersion:1,confirmed:true,key:randomUUID()})));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.code,'23505');
 const pending=race.find(r=>r.status==='fulfilled').value;
 await call(owner,'cancel',person.id,{rosterVersion:1,requestId:pending.id,requestVersion:1,confirmed:true});
 await assert.rejects(call(candidate,'accept',pending.id,proof),{code:'40001'});
 // A current HR issuer is rechecked under locks; owner can explicitly renew.
 const hrPerson=await roster(hr);await pool.query("update internal_employees set status='active' where id=$1",[hrPerson.id]);
 await require('./employee-link-fixture')(pool,owner,hr,hrPerson.id);
 await pool.query("select internal_employee_command($1,'grant_hr',$2,$3)",[owner,hrPerson.id,{version:1,confirmed:true}]);
 const issued=await call(hr,'request',person.id,{rosterVersion:1,confirmed:true,key:randomUUID()});
 await pool.query("select internal_employee_command($1,'revoke_hr',$2,$3)",[owner,hrPerson.id,{version:2,confirmed:true}]);
 assert.equal((await call(candidate,'inbox')).requests.length,0);await assert.rejects(call(candidate,'accept',issued.id,proof),{code:'42501'});
 await call(owner,'renew',person.id,{rosterVersion:1,requestId:issued.id,requestVersion:1,confirmed:true});
 await call(candidate,'accept',issued.id,{...proof,requestVersion:2,verifiedAt:new Date().toISOString()});
 await pool.query("update internal_employees set status='inactive' where id=$1",[person.id]);assert.equal((await call(candidate,'inbox')).employment.length,0);
 await pool.query("update internal_employees set status='active' where id=$1",[person.id]);assert.equal((await call(candidate,'inbox')).employment.length,0,'Reactivation must not restore a revoked link');
 assert.equal((await pool.query('select role,status from organization_memberships where organization_id=$1 and user_id=$2',[org,candidate])).rows[0].role,'admin');
 assert.equal((await pool.query('select role_code from user_app_roles where organization_id=$1 and user_id=$2',[org,candidate])).rows[0].role_code,'viewer');
 assert.equal((await pool.query('select role,status from project_memberships where project_id=$1 and user_id=$2',[project.id,candidate])).rows[0].status,'active');
 // Clock expiry during a roster lock wait cannot be rescued by an earlier
 // session check or still-fresh credential proof.
 const expiring=await call(owner,'request',person.id,{rosterVersion:1,confirmed:true,key:randomUUID()});
 await pool.query("update portal_sessions set expires_at=clock_timestamp()+interval '1 second' where token_hash=$1",[tokens.get(candidate)]);
 const locker=await pool.connect(),waiter=await pool.connect();let blockedCall;
 try{
  await locker.query('begin');await locker.query('select 1 from internal_employees where id=$1 for update',[person.id]);
  const pid=(await waiter.query('select pg_backend_pid() pid')).rows[0].pid;
  blockedCall=waiter.query('select internal_employee_identity($1,$2,$3,$4)',[candidate,'accept',expiring.id,{...proof,verifiedAt:new Date().toISOString(),currentHash:tokens.get(candidate)}]).then(value=>({value}),error=>({error}));
  let waiting=false;for(let n=0;n<30;n++){waiting=(await pool.query('select cardinality(pg_blocking_pids($1))>0 waiting',[pid])).rows[0].waiting;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
  assert.ok(waiting);await new Promise(r=>setTimeout(r,1100));await locker.query('commit');assert.equal((await blockedCall).error?.code,'42501');
 }finally{await locker.query('rollback');if(blockedCall)await blockedCall;locker.release();waiter.release();}
 assert.equal((await pool.query('select state from internal_employee_link_requests where id=$1',[expiring.id])).rows[0].state,'pending');
 // Browser roles cannot bypass either purpose or consent checks.
 for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('set role '+role);for(const table of ['internal_employee_link_requests','internal_employee_identity_links'])await assert.rejects(c.query('select * from '+table),{code:'42501'});await assert.rejects(c.query("select internal_employee_identity($1,'inbox',null,'{}')",[candidate]),{code:'42501'});}finally{await c.query('reset role');c.release();}}
 for(const bad of [0,2147483648,'1',1.5])await assert.rejects(call(owner,'request',person.id,{...requestData,rosterVersion:bad}),{code:'22023'});
 // HTTP verification uses the fake provider, but consent persists in PostgreSQL.
 const httpPerson=await roster(outsider),raw='link-http-'+randomUUID(),hash=hashToken(raw);tokens.set(outsider,hash);
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hash,outsider]);
 const httpRequest=await call(owner,'request',httpPerson.id,{rosterVersion:1,confirmed:true,key:randomUUID()});
 const factory=require('../fixtures/identity-provider')(async email=>(await pool.query('select id,email from profiles where email=$1',[email])).rows[0],{mfaEmails:[emails.get(outsider)]});
 let providerUnavailable=false;const authFactory=()=>providerUnavailable?{auth:{signInWithPassword:async()=>({error:{status:503},data:{session:null,user:null}})}}:factory();
 const server=require('./http-fixture')(pool,undefined,authFactory).listen(0,'127.0.0.1');await once(server,'listening');
 try{const base='http://127.0.0.1:'+server.address().port,headers={Origin:'http://localhost:3000',Cookie:'vsph.portal.sid='+raw,'Content-Type':'application/json'},send=body=>fetch(base+'/api/employee-identity/requests/'+httpRequest.id+'/accept',{method:'POST',headers,body:JSON.stringify(body)}),body={rosterVersion:1,requestVersion:1,confirmed:true,password:'fixture-password-only'};
  assert.equal((await fetch(base+'/api/employee-identity/mine')).status,401);
  providerUnavailable=true;assert.equal((await send(body)).status,503);providerUnavailable=false;
  const ownerRaw='link-owner-http-'+randomUUID();await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hashToken(ownerRaw),owner]);
  await pool.query('alter function internal_employee_identity(uuid,text,uuid,jsonb) rename to fixture_unavailable_employee_identity');
  try{const missing=await fetch(base+'/api/employees/'+httpPerson.id+'/grant_hr',{method:'POST',headers:{...headers,Cookie:'vsph.portal.sid='+ownerRaw},body:JSON.stringify({version:1,confirmed:true})});assert.equal(missing.status,503);assert.equal((await missing.json()).code,'SCHEMA_NOT_READY');}
  finally{await pool.query('alter function fixture_unavailable_employee_identity(uuid,text,uuid,jsonb) rename to internal_employee_identity');}
  const noMfa=await send(body);assert.equal(noMfa.status,401);assert.equal((await noMfa.json()).code,'MFA_REQUIRED');assert.equal((await send({...body,totpCode:'000000'})).status,401);
  assert.equal((await send({...body,verifiedAt:new Date().toISOString()})).status,400);
  assert.equal((await pool.query('select count(*) from internal_employee_identity_links where employee_id=$1',[httpPerson.id])).rows[0].count,'0');
  const good=await send({...body,totpCode:'123456'});assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'no-store');assert.equal((await good.json()).linked,true);
  await pool.query("update profiles set status='disabled' where id=$1",[outsider]);assert.equal((await pool.query('select status from internal_employee_identity_links where employee_id=$1',[httpPerson.id])).rows[0].status,'revoked');
  assert.equal((await fetch(base+'/api/employee-identity/mine',{headers})).status,401);
 }finally{await new Promise(r=>server.close(r));}
};
