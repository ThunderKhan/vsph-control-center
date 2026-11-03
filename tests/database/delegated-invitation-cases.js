const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async(pool,app)=>{
 const [owner,admin,recipient,outsider]=Array.from({length:4},()=>crypto.randomUUID());
 for(const [i,id] of [owner,admin,recipient,outsider].entries()){
  await pool.query('insert into auth.users values($1)',[id]);await pool.query('insert into profiles(id,full_name,email) values($1,$2,$3)',[id,'Delegated invite '+i,id+'@fixture.test']);
 }
 const org=(await pool.query("insert into organizations(name,slug) values('Delegated invitations','delegated-invitations') returning id")).rows[0].id;
 for(const [id,role] of [[owner,'owner'],[admin,'admin']])await pool.query('insert into organization_memberships(organization_id,user_id,role) values($1,$2,$3)',[org,id,role]);
 await pool.query('insert into organization_app_access(organization_id,application_id) values($1,$2)',[org,app]);await pool.query("insert into subscriptions(organization_id,application_id,status) values($1,$2,'active')",[org,app]);await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,'admin')",[org,owner,app]);
 const request={kind:'member',delegated:true,organizationId:org,adminName:'Existing recipient',adminEmail:recipient+'@fixture.test',memberRole:'member',products:[{applicationId:app,role:'staff'}]},key=crypto.randomUUID();
 const cmd=async(action,data={},actor=owner,tenant=org)=>(await pool.query('select organization_invitation($1,$2,$3,$4) data',[actor,action,tenant,data])).rows[0].data;
 const provision=async(action,id,data={},actor=null)=>(await pool.query('select provisioning_command($1,$2,$3,$4) data',[actor,action,id,data])).rows[0].data;
 await assert.rejects(cmd('queue',{key,request},outsider),{code:'42501'});
 await assert.rejects(cmd('queue',{key,request:{...request,memberRole:'owner'}}),{code:'42501'});
 await assert.rejects(cmd('queue',{key,request:{...request,memberRole:'admin',products:[]}},admin),{code:'42501'});
 await assert.rejects(cmd('queue',{key,request:{...request,products:[{applicationId:app,role:'super_admin'}]}}),{code:'42501'});
 const queued=await Promise.all([cmd('queue',{key,request}),cmd('queue',{key,request})]);assert.equal(queued[0].id,queued[1].id);
 await assert.rejects(cmd('queue',{key,request:{...request,adminName:'Different'}}),{code:'23505'});
 await assert.rejects(cmd('queue',{key:crypto.randomUUID(),request}),{code:'23505'});
 const job=queued[0].id,inv=(await pool.query('select * from membership_invitations where job_id=$1',[job])).rows[0],outbox=(await pool.query('select id from invitation_outbox where invitation_id=$1',[inv.id])).rows[0].id;
 assert.equal((await cmd('list')).length,1);assert.deepEqual(await cmd('list',{},admin),[]);
 const mutation={invitationId:inv.id,generation:1,confirmed:true};
 await assert.rejects(cmd('cancel',mutation,admin),{code:'42501'});
 await assert.rejects(cmd('cancel',{...mutation,generation:2}),{code:'40001'});
 // Run the real durable worker against this native DB, with external delivery
 // deliberately failing after an attempted send; the retry reuses its capability.
 const deliveries=[];
 const client={auth:{admin:{getUserById:async()=>{throw Error('Existing identity must not be reallocated');},createUser:async()=>{throw Error('Existing identity must not be recreated');}}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:recipient},error:null})})})}),rpc:async(name,args)=>{
  assert.equal(name,'provisioning_command');
  try{
   if(args.p_action==='claim'){
    await pool.query("update invitation_outbox set state='leased',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '2 minutes' where id=$2",[args.p_id,outbox]);
    const data=(await pool.query('select jsonb_build_object(\'outbox\',to_jsonb(o),\'invitation\',to_jsonb(i),\'job\',to_jsonb(j)) data from invitation_outbox o join membership_invitations i on i.id=o.invitation_id join provisioning_jobs j on j.id=i.job_id where o.id=$1',[outbox])).rows[0].data;
    return {data,error:null};
   }
   return {data:await provision(args.p_action,args.p_id,args.p_data),error:null};
  }catch(error){return {data:null,error};}
 }};
 const {dispatchOne,hash}=require('../../services/invitation-worker');
 await assert.rejects(dispatchOne({client,key:'a'.repeat(64),origin:'http://localhost:3000',deliver:async delivery=>{deliveries.push(delivery);throw Error('Synthetic SMTP timeout');}}),/retry or reconciliation/);
 assert.equal((await pool.query('select state from provisioning_jobs where id=$1',[job])).rows[0].state,'requires_attention');
 await dispatchOne({client,key:'a'.repeat(64),origin:'http://localhost:3000',deliver:async delivery=>deliveries.push(delivery)});
 assert.equal(deliveries.length,2);assert.equal(deliveries[0].url,deliveries[1].url);assert.equal(deliveries[0].idempotencyKey,deliveries[1].idempotencyKey);
 const token=new URLSearchParams(new URL(deliveries[1].url).hash.slice(1)).get('invitation_token');
 const proof={tokenHash:hash(token),acceptanceId:crypto.randomUUID()};
 await assert.rejects(provision('reserve_accept',inv.id,proof,outsider),{code:'42501'});
 await pool.query("update organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,owner]);
 await assert.rejects(provision('inspect',inv.id,proof),{code:'42501'});await assert.rejects(provision('reserve_accept',inv.id,proof,recipient),{code:'42501'});
 await pool.query("update organization_memberships set status='active' where organization_id=$1 and user_id=$2",[org,owner]);
 await pool.query("update membership_invitations set expires_at=now()-interval '1 second' where id=$1",[inv.id]);await assert.rejects(provision('reserve_accept',inv.id,proof,recipient),{code:'42501'});
 const renewed=await Promise.allSettled([cmd('reissue',mutation),cmd('reissue',mutation)]);assert.equal(renewed.filter(r=>r.status==='fulfilled').length,1);assert.equal(renewed.find(r=>r.status==='rejected').reason.code,'40001');
 await assert.rejects(provision('reserve_accept',inv.id,proof,recipient),{code:'42501'});
 await dispatchOne({client,key:'a'.repeat(64),origin:'http://localhost:3000',deliver:async delivery=>deliveries.push(delivery)});
 const nextToken=new URLSearchParams(new URL(deliveries.at(-1).url).hash.slice(1)).get('invitation_token'),accept={tokenHash:hash(nextToken),acceptanceId:crypto.randomUUID()};
 await provision('reserve_accept',inv.id,accept,recipient);
 await pool.query("delete from user_app_roles where organization_id=$1 and user_id=$2 and application_id=$3",[org,owner,app]);await assert.rejects(provision('finish_accept',inv.id,accept),{code:'42501'});
 assert.equal((await pool.query('select status from organization_memberships where organization_id=$1 and user_id=$2',[org,recipient])).rows[0].status,'invited');
 await provision('accept_failed',inv.id,accept);
 await assert.rejects(cmd('reissue',{...mutation,generation:2}),{code:'40001'});
 // A second independent member-only invitation can be cancelled without product
 // authority; cancellation never repairs ambiguous acceptance or activates users.
 const second=await cmd('queue',{key:crypto.randomUUID(),request:{...request,adminEmail:crypto.randomUUID()+'@fixture.test',products:[]}});
 const secondInv=(await pool.query('select id from membership_invitations where job_id=$1',[second.id])).rows[0].id;
 await cmd('cancel',{invitationId:secondInv,generation:1,confirmed:true});assert.equal((await pool.query('select state from membership_invitations where id=$1',[secondInv])).rows[0].state,'revoked');
 // Existing identities can own separate tenants and be invited into each other.
 // Before worker bind, invitation.user_id is NULL; cancellation must still lock
 // both real recipient profiles in one consistent global order.
 const otherOrg=(await pool.query("insert into organizations(name,slug) values('Cross-invitation tenant','cross-invitation-tenant') returning id")).rows[0].id;
 await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[otherOrg,outsider]);
 const crossRequest={...request,products:[],adminEmail:outsider+'@fixture.test'};
 const firstCross=await cmd('queue',{key:crypto.randomUUID(),request:crossRequest});
 const secondCross=await cmd('queue',{key:crypto.randomUUID(),request:{...request,products:[],organizationId:otherOrg,adminEmail:owner+'@fixture.test'}},outsider,otherOrg);
 const crossInvites=(await pool.query('select id,job_id,user_id from membership_invitations where job_id=any($1::uuid[])',[[firstCross.id,secondCross.id]])).rows;
 assert.ok(crossInvites.every(i=>i.user_id===null));
 const crossResults=await Promise.allSettled([
  cmd('cancel',{invitationId:crossInvites.find(i=>i.job_id===firstCross.id).id,generation:1,confirmed:true}),
  cmd('cancel',{invitationId:crossInvites.find(i=>i.job_id===secondCross.id).id,generation:1,confirmed:true},outsider,otherOrg),
 ]);
 assert.ok(crossResults.every(r=>r.status==='fulfilled'),JSON.stringify(crossResults.map(r=>r.reason?.code)));
 for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('set role '+role);await assert.rejects(c.query("select organization_invitation($1,'list',$2,'{}')",[owner,org]),{code:'42501'});await assert.rejects(c.query("select organization_invitation_core($1,'list',$2,'{}')",[owner,org]),{code:'42501'});await assert.rejects(c.query("select provisioning_core_command(null,'inspect',$1,'{}')",[inv.id]),{code:'42501'});}finally{await c.query('reset role');c.release();}}
};
