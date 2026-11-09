const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const owner='44444444-4444-4444-8444-444444444444';
 const payload={organizationName:'Custom Development Client',slug:'custom-only-'+randomUUID().slice(0,8),
  adminName:'Customer Owner',adminEmail:'only-'+randomUUID().slice(0,8)+'@example.test',products:[]};
 const key=randomUUID(),call=async(actor,id,data)=>
  (await pool.query('select public.organization_only_onboarding($1,$2,$3) d',[actor,id,data])).rows[0].d;
 await assert.rejects(call('11111111-1111-4111-8111-111111111111',randomUUID(),payload),{code:'42501'});
 await assert.rejects(call(owner,randomUUID(),{...payload,products:[{applicationId:randomUUID()}]}),{code:'22023'});
 const [first,replay]=await Promise.all([call(owner,key,payload),call(owner,key,payload)]);
 assert.equal(first.id,replay.id);
 await assert.rejects(call(owner,key,{...payload,organizationName:'Changed'}),{code:'23505'});
 const org=await pool.query('select name from public.organizations where id=$1',[first.organization_id]);
 assert.equal(org.rows[0].name,payload.organizationName);
 assert.equal((await pool.query('select count(*)::int n from public.subscriptions where organization_id=$1',[first.organization_id])).rows[0].n,0);
 assert.equal((await pool.query('select count(*)::int n from public.organization_app_access where organization_id=$1',[first.organization_id])).rows[0].n,0);
 assert.equal((await pool.query('select count(*)::int n from public.membership_invitations where organization_id=$1',[first.organization_id])).rows[0].n,1);
 assert.equal((await pool.query('select count(*)::int n from public.invitation_outbox where invitation_id in (select id from public.membership_invitations where organization_id=$1)',[first.organization_id])).rows[0].n,1);

 const cmd=async(action,id,payload={},actor=null)=>
  (await pool.query('select public.provisioning_command($1,$2,$3,$4) d',[actor,action,id,payload])).rows[0].d;
 const duplicateKey=randomUUID();
 await assert.rejects(call(owner,duplicateKey,{...payload,adminEmail:'different@example.test'}),{code:'23505'});
 assert.equal((await pool.query('select count(*)::int n from public.provisioning_jobs where actor_id=$1 and idempotency_key=$2',[owner,duplicateKey])).rows[0].n,0,'Duplicate slug must not create an orphan job');
 const invitation=(await pool.query('select * from public.membership_invitations where job_id=$1',[first.id])).rows[0];
 const outbox=(await pool.query('select id from public.invitation_outbox where invitation_id=$1',[invitation.id])).rows[0];
 const lease=randomUUID(),createdUser=invitation.auth_user_id;
 await pool.query('insert into auth.users(id) values($1)',[createdUser]);
 await pool.query("update public.invitation_outbox set state='leased',attempts=1,lease_token=$1,lease_until=now()+interval '2 minutes' where id=$2",[lease,outbox.id]);
 const tokenHash='a'.repeat(64),acceptanceId=randomUUID();
 await cmd('bind',outbox.id,{lease,userId:createdUser,tokenHash,encryptedDelivery:'fixture'},null);
 assert.equal((await pool.query('select role from public.organization_memberships where organization_id=$1 and user_id=$2',[first.organization_id,createdUser])).rows[0].role,'owner');
 assert.equal((await pool.query('select status from public.organization_memberships where organization_id=$1 and user_id=$2',[first.organization_id,createdUser])).rows[0].status,'invited');
 assert.equal((await pool.query('select platform_role from public.profiles where id=$1',[createdUser])).rows[0].platform_role,'user','Customer ownership must not elevate the platform role');
 await cmd('sent',outbox.id,{lease},null);
 await assert.rejects(cmd('reserve_accept',invitation.id,{tokenHash:'b'.repeat(64),acceptanceId},null),{code:'42501'});
 await cmd('reserve_accept',invitation.id,{tokenHash,acceptanceId},null);
 await cmd('finish_accept',invitation.id,{acceptanceId},null);
 assert.equal((await pool.query('select status from public.organization_memberships where organization_id=$1 and user_id=$2',[first.organization_id,createdUser])).rows[0].status,'active','Only accepted invitations activate customer owners');
 assert.equal((await pool.query('select status from public.profiles where id=$1',[createdUser])).rows[0].status,'active');
 assert.equal((await pool.query('select state from public.provisioning_jobs where id=$1',[first.id])).rows[0].state,'ready');
 assert.equal((await pool.query('select count(*)::int n from public.user_app_roles where organization_id=$1',[first.organization_id])).rows[0].n,0,'Custom-only owner must not receive catalog product roles');
 await assert.rejects(cmd('reserve_accept',invitation.id,{tokenHash,acceptanceId},null),{code:'42501'},'Invitation must not be replayable after acceptance');

 const browser=await pool.connect();
 try{
  for(const role of ['anon','authenticated']){
   await browser.query('set role '+role);
   await assert.rejects(browser.query('select public.organization_only_onboarding($1,$2,$3)',[owner,randomUUID(),payload]),{code:'42501'});
   await browser.query('reset role');
  }
 }finally{await browser.query('reset role');browser.release();}
};
