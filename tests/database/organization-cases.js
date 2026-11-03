const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async(pool,app)=>{
 const ids=Array.from({length:6},()=>crypto.randomUUID()),[owner,admin,member,viewer,outsider,otherOwner]=ids;
 for(const [i,id] of ids.entries()){
  await pool.query('insert into auth.users values($1)',[id]);
  await pool.query("insert into profiles(id,full_name,email) values($1,$2,$3)",[id,'Organization fixture '+i,id+'@fixture.test']);
 }
 const org=(await pool.query("insert into organizations(name,slug) values('Delegated fixture','delegated-fixture') returning id")).rows[0].id;
 const other=(await pool.query("insert into organizations(name,slug) values('Private other fixture','delegated-other') returning id")).rows[0].id;
 for(const [id,role] of [[owner,'owner'],[admin,'admin'],[member,'member'],[viewer,'viewer']])await pool.query('insert into organization_memberships(organization_id,user_id,role) values($1,$2,$3)',[org,id,role]);
 await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[other,otherOwner]);
 const cmd=async(action,data={},actor=owner,tenant=org)=>(await pool.query('select organization_command($1,$2,$3,$4) data',[actor,action,tenant,data])).rows[0].data;
 for(const actor of [admin,owner])assert.equal((await cmd('read',{},actor)).organization.id,org);
 for(const actor of [member,viewer,outsider,null,'44444444-4444-4444-8444-444444444444'])await assert.rejects(cmd('read',{},actor),{code:'42501'});
 await assert.rejects(cmd('read',{},owner,other),{code:'42501'});
 assert.deepEqual((await cmd('list')).map(o=>o.id),[org]);
 const change={userId:member,version:1,role:'viewer',status:'active',confirmed:true};
 await assert.rejects(cmd('member',{...change,role:'admin'},admin),{code:'42501'});
 await assert.rejects(cmd('member',{...change,userId:owner}),{code:'42501'});
 await assert.rejects(cmd('member',{...change,userId:admin},admin),{code:'42501'});
 await assert.rejects(cmd('member',{...change,confirmed:false}),{code:'22023'});
 await assert.rejects(cmd('profile',{version:1,name:'Escalation',platform_role:'super_admin'}),{code:'40001'});
 const race=await Promise.allSettled([1,2].map(i=>cmd('profile',{version:1,name:'Delegated '+i})));
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.code,'40001');
 const role={userId:member,version:1,applicationId:app,role:'staff',confirmed:true};
 await assert.rejects(cmd('role',role),{code:'42501'});
 await pool.query("insert into organization_app_access(organization_id,application_id) values($1,$2)",[org,app]);
 await pool.query("insert into subscriptions(organization_id,application_id,status) values($1,$2,'active')",[org,app]);
 await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,'admin')",[org,owner,app]);
 await assert.rejects(cmd('role',{...role,role:'super_admin'}),{code:'42501'});
 await cmd('role',role);await assert.rejects(cmd('role',role),{code:'40001'});
 await pool.query("update subscriptions set ends_at=now()-interval '1 minute' where organization_id=$1",[org]);
 await assert.rejects(cmd('role',{...role,version:2}),{code:'42501'});
 await pool.query('update subscriptions set ends_at=null where organization_id=$1',[org]);
 const pending=crypto.randomUUID();await pool.query('insert into auth.users values($1)',[pending]);await pool.query("insert into profiles(id,full_name,email) values($1,'Invited fixture',$2)",[pending,pending+'@fixture.test']);
 await pool.query("insert into organization_memberships(organization_id,user_id,status) values($1,$2,'invited')",[org,pending]);
 await assert.rejects(cmd('member',{...change,userId:pending}),{code:'22023'});
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values('delegated-test-portal',$1,now()+interval '1 hour')",[member]);
 await pool.query("insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values('delegated-test-app','delegated-test-portal',$1,$2,$3,now()+interval '1 hour')",[member,org,app]);
 await cmd('member',{...change,version:2,status:'suspended'},admin);
 assert.equal((await pool.query("select count(*) from app_sessions where token_hash='delegated-test-app'")).rows[0].count,'0');
 assert.equal((await cmd('members')).find(m=>m.user_id===member).version,3);
 await pool.query('update profiles set status=\'disabled\' where id=$1',[member]);
 await assert.rejects(cmd('member',{...change,version:3}),{code:'42501'});
 await pool.query("update organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,admin]);
 await assert.rejects(cmd('read',{},admin),{code:'42501'});
 await pool.query("create function public.organization_audit_outage() returns trigger language plpgsql as $$begin raise exception 'Synthetic outage';end$$;create trigger organization_audit_outage before insert on audit_logs for each row execute function organization_audit_outage()");
 try{await assert.rejects(cmd('profile',{version:2,name:'Must rollback'}),{code:'P0001'});}finally{await pool.query('drop trigger organization_audit_outage on audit_logs;drop function organization_audit_outage()');}
 assert.notEqual((await cmd('read')).organization.name,'Must rollback');
 assert.equal((await cmd('read')).organization.version,2);
 // Cross-tenant owners may target each other as ordinary members. Their profile
 // locks must have a global order even though the organizations differ.
 await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'member'),($3,$4,'member')",[org,otherOwner,other,owner]);
 const cross=await Promise.allSettled([
  cmd('member',{userId:otherOwner,version:1,role:'viewer',status:'active',confirmed:true},owner,org),
  cmd('member',{userId:owner,version:1,role:'viewer',status:'active',confirmed:true},otherOwner,other),
 ]);
 assert.ok(cross.every(r=>r.status==='fulfilled'),JSON.stringify(cross.map(r=>r.reason?.code)));
 // A committed revocation must be observed by a request that waited for the org lock.
 const c=await pool.connect();try{
  await c.query('begin');await c.query('select id from organizations where id=$1 for no key update',[org]);
  const waiting=cmd('profile',{version:2,name:'Forbidden after revoke'}).catch(e=>e);
  await c.query("update organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,owner]);await c.query('commit');
  assert.equal((await waiting).code,'42501');
 }finally{await c.query('rollback');c.release();}
 await pool.query("update organization_memberships set status='active' where organization_id=$1 and user_id=$2",[org,owner]);
 await pool.query("update organizations set status='suspended' where id=$1",[org]);await assert.rejects(cmd('read'),{code:'42501'});
 await pool.query("update organizations set status='active' where id=$1",[org]);
 for(const roleName of ['anon','authenticated']){const client=await pool.connect();try{await client.query('set role '+roleName);await assert.rejects(client.query("select organization_command($1,'read',$2,'{}')",[owner,org]),{code:'42501'});}finally{await client.query('reset role');client.release();}}
 const {hashToken}=require('../../tokens');
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour'),($3,$2,now()-interval '1 second')",[hashToken('delegated-live'),owner,hashToken('delegated-expired')]);
 const server=require('./http-fixture')(pool).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  for(const cookie of ['', 'vsph.portal.sid=delegated-expired'])assert.equal((await fetch(base+'/api/organizations/'+org,{headers:{Cookie:cookie}})).status,401);
  const response=await fetch(base+'/api/organizations/'+org,{headers:{Cookie:'vsph.portal.sid=delegated-live'}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(base+'/api/organizations/'+other,{headers:{Cookie:'vsph.portal.sid=delegated-live'}})).status,403);
  assert.equal((await fetch(base+'/api/organizations/'+org+'/member',{method:'POST',headers:{Cookie:'vsph.portal.sid=delegated-live','Content-Type':'application/json',Origin:'http://localhost:3000'},body:JSON.stringify({...change,role:'owner'})})).status,400);
 }finally{await new Promise(r=>server.close(r));}
};
