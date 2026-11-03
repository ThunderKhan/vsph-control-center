const assert=require('node:assert/strict'),crypto=require('node:crypto'),{once}=require('node:events'),{hashToken,newToken}=require('../../tokens');
module.exports=async(pool,app)=>{
 const [owner,target,outsider,pending]=Array.from({length:4},()=>crypto.randomUUID()),session=hashToken('ownership-current-session'),otherSession=hashToken('ownership-other-session');
 for(const [i,id] of [owner,target,outsider,pending].entries()){await pool.query('insert into auth.users values($1)',[id]);await pool.query('insert into profiles(id,full_name,email) values($1,$2,$3)',[id,'Ownership fixture '+i,id+'@fixture.test']);}
 const org=(await pool.query("insert into organizations(name,slug) values('Ownership fixture','ownership-fixture') returning id")).rows[0].id;
 const otherOrg=(await pool.query("insert into organizations(name,slug) values('Ownership other','ownership-other') returning id")).rows[0].id;
 for(const tenant of [org,otherOrg])await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin')",[tenant,owner,target]);
 await pool.query("insert into organization_memberships(organization_id,user_id,role,status) values($1,$2,'admin','invited')",[org,pending]);
 for(const [token,id] of [[session,owner],[otherSession,owner],[hashToken('ownership-outsider-session'),outsider]])await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[token,id]);
 const cmd=async(action,data={},actor=owner,tenant=org,hash=session)=>(await pool.query('select organization_ownership($1,$2,$3,$4) data',[actor,action,tenant,{...data,currentHash:hash}])).rows[0].data;
 const preview=()=>cmd('preview',{targetUserId:target});
 const intent=p=>({targetUserId:p.targetUserId,organizationVersion:p.organizationVersion,ownerVersion:p.ownerVersion,targetVersion:p.targetVersion});
 const issue=async(p,extra={})=>{const raw=newToken(),data={...intent(p),proofHash:hashToken(raw),verifiedAt:new Date().toISOString(),assurance:'aal2',...extra};await cmd('authorize',data);return {raw,data};};
 for(const actor of [target,outsider,'44444444-4444-4444-8444-444444444444'])await assert.rejects(cmd('preview',{targetUserId:target},actor),e=>['42501','22023'].includes(e.code));
 await assert.rejects(cmd('preview',{targetUserId:owner}),{code:'22023'});await assert.rejects(cmd('preview',{targetUserId:pending}),{code:'42501'});
 await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,outsider]);await assert.rejects(preview(),{code:'40001'});await pool.query("update organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",[org,outsider]);
 await pool.query("update organizations set status='suspended' where id=$1",[org]);await assert.rejects(preview(),{code:'42501'});await pool.query("update organizations set status='active' where id=$1",[org]);
 const p=await preview();await assert.rejects(issue(p,{verifiedAt:new Date(Date.now()-31000).toISOString()}),{code:'42501'});
 const first=await issue(p),second=await issue(p);
 await assert.rejects(cmd('transfer',{...intent(p),proofHash:hashToken(first.raw),confirmed:true}),{code:'42501'});
 await assert.rejects(cmd('transfer',{...intent(p),proofHash:hashToken(second.raw),confirmed:true},owner,org,otherSession),{code:'42501'});
 await assert.rejects(cmd('transfer',{...intent(p),proofHash:hashToken(second.raw),confirmed:true},owner,otherOrg),{code:'42501'});
 await assert.rejects(cmd('transfer',{...intent(p),proofHash:hashToken(second.raw)}),{code:'22023'});
 await pool.query("update organization_owner_transfer_grants set verified_at=now()-interval '3 minutes',expires_at=now()-interval '1 second' where token_hash=$1",[hashToken(second.raw)]);
 await assert.rejects(cmd('transfer',{...intent(p),proofHash:hashToken(second.raw),confirmed:true}),{code:'42501'});
 const stale=await issue(p);await pool.query('update organization_memberships set version=version+1 where organization_id=$1 and user_id=$2',[org,target]);await assert.rejects(cmd('transfer',{...intent(p),proofHash:hashToken(stale.raw),confirmed:true}),{code:'40001'});
 const fresh=await preview(),proof=await issue(fresh);
 await pool.query("update portal_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[session]);await assert.rejects(cmd('transfer',{...intent(fresh),proofHash:hashToken(proof.raw),confirmed:true}),{code:'42501'});await pool.query("update portal_sessions set expires_at=now()+interval '1 hour' where token_hash=$1",[session]);
 await pool.query("update profiles set status='disabled' where id=$1",[target]);await assert.rejects(cmd('transfer',{...intent(fresh),proofHash:hashToken(proof.raw),confirmed:true}),{code:'42501'});await pool.query("update profiles set status='active' where id=$1",[target]);
 await pool.query("insert into organization_app_access(organization_id,application_id) values($1,$2)",[org,app]);await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,'viewer')",[org,owner,app]);
 await pool.query("insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values('ownership-product',$1,$2,$3,$4,now()+interval '1 hour')",[session,owner,org,app]);
 await pool.query("create function public.ownership_audit_outage() returns trigger language plpgsql as $$begin raise exception 'Synthetic ownership audit outage';end$$;create trigger ownership_audit_outage before insert on audit_logs for each row execute function ownership_audit_outage()");
 try{await assert.rejects(cmd('transfer',{...intent(fresh),proofHash:hashToken(proof.raw),confirmed:true}),{code:'P0001'});}finally{await pool.query('drop trigger ownership_audit_outage on audit_logs;drop function ownership_audit_outage()');}
 assert.equal((await pool.query('select consumed_at from organization_owner_transfer_grants where token_hash=$1',[hashToken(proof.raw)])).rows[0].consumed_at,null);
 assert.equal((await pool.query('select role from organization_memberships where organization_id=$1 and user_id=$2',[org,owner])).rows[0].role,'owner');
 assert.equal((await pool.query("select count(*) from app_sessions where token_hash='ownership-product'")).rows[0].count,'1');
 const race=await Promise.allSettled([1,2].map(()=>cmd('transfer',{...intent(fresh),proofHash:hashToken(proof.raw),confirmed:true})));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await pool.query("select count(*) from organization_memberships where organization_id=$1 and role='owner' and status='active'",[org])).rows[0].count,'1');
 assert.equal((await pool.query("select count(*) from audit_logs where organization_id=$1 and action='organization.owner_transferred'",[org])).rows[0].count,'1');
 assert.equal((await pool.query('select role from organization_memberships where organization_id=$1 and user_id=$2',[org,target])).rows[0].role,'owner');
 assert.equal((await pool.query('select role from organization_memberships where organization_id=$1 and user_id=$2',[org,owner])).rows[0].role,'admin');
 assert.equal((await pool.query('select role_code from user_app_roles where organization_id=$1 and user_id=$2',[org,owner])).rows[0].role_code,'viewer');
 assert.equal((await pool.query('select count(*) from user_app_roles where organization_id=$1 and user_id=$2',[org,target])).rows[0].count,'0');
 assert.equal((await pool.query("select count(*) from app_sessions where token_hash='ownership-product'")).rows[0].count,'0');
 await assert.rejects(cmd('transfer',{...intent(fresh),proofHash:hashToken(proof.raw),confirmed:true}),{code:'42501'});
 // The real HTTP path must verify the signed-in owner's credentials; untrusted
 // assurance/time/hash fields cannot mint an authorization grant.
 const events=[],factory=require('../fixtures/identity-provider')(async email=>(await pool.query('select id,email from profiles where email=$1',[email])).rows[0],{mfaEmails:[owner+'@fixture.test'],events});
 const server=require('./http-fixture')(pool,undefined,factory).listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const base='http://127.0.0.1:'+server.address().port,path='/api/organizations/'+otherOrg+'/ownership',headers={Origin:'http://localhost:3000',Cookie:'vsph.portal.sid=ownership-current-session','Content-Type':'application/json'};
  const get=await fetch(base+path+'/preview?targetUserId='+target,{headers});assert.equal(get.status,200);const review=intent(await get.json());
  assert.equal((await fetch(base+path+'/preview?targetUserId='+target)).status,401);
  assert.equal((await fetch(base+path+'/preview?targetUserId='+target,{headers:{...headers,Cookie:'vsph.portal.sid=ownership-outsider-session'}})).status,403);
  const reauth=body=>fetch(base+path+'/reauthenticate',{method:'POST',headers,body:JSON.stringify({...review,...body})});
  assert.equal((await reauth({password:'fixture-password-only',assurance:'aal2'})).status,400);assert.deepEqual(events,[]);
  const wrong=await reauth({password:'incorrect'});assert.equal(wrong.status,401);assert.equal((await wrong.json()).code,'INVALID_CREDENTIALS');
  assert.equal((await reauth({password:'fixture-password-only'})).status,401);
  assert.equal((await pool.query('select count(*) from organization_owner_transfer_grants where organization_id=$1',[otherOrg])).rows[0].count,'0');
  const allowed=await reauth({password:'fixture-password-only',totpCode:'123456'});assert.equal(allowed.status,200);const grant=await allowed.json();assert.match(grant.proof,/^[A-Za-z0-9_-]{43}$/);assert.doesNotMatch(JSON.stringify(grant),/access_token|refresh_token|fixture-password/);
  assert.equal((await pool.query('select count(*) from organization_owner_transfer_grants where token_hash=$1',[hashToken(grant.proof)])).rows[0].count,'1');
  const transfer=proofValue=>fetch(base+path+'/transfer',{method:'POST',headers:{...headers,...(proofValue?{'X-VSPH-Step-Up':proofValue}:{})},body:JSON.stringify({...review,confirmed:true})});
  assert.equal((await transfer()).status,400);assert.equal((await transfer(newToken())).status,403);assert.equal((await transfer(grant.proof)).status,200);assert.equal((await transfer(grant.proof)).status,403);
  const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers,body:'{}'});assert.equal(logout.status,200);assert.equal((await pool.query('select count(*) from organization_owner_transfer_grants where session_hash=$1',[session])).rows[0].count,'0');
 }finally{await new Promise(r=>server.close(r));}
 for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('set role '+role);await assert.rejects(c.query('select * from organization_owner_transfer_grants'),{code:'42501'});await assert.rejects(c.query("select organization_ownership($1,'preview',$2,'{}')",[owner,org]),{code:'42501'});}finally{await c.query('reset role');c.release();}}
};
