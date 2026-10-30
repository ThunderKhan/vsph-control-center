const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async function(pool,appId){
 const actor='44444444-4444-4444-8444-444444444444';
 const cmd=async(action,id,data={},who=actor)=>(await pool.query('select provisioning_command($1,$2,$3,$4) data',[who,action,id,data])).rows[0].data;
 const payload={organizationName:'Provisioned Fixture',slug:'provisioned-fixture',adminName:'Invited Owner',adminEmail:'invited-owner@example.test',products:[{applicationId:appId,planCode:'standard',status:'active',endsAt:null}]};
 const key=crypto.randomUUID();
 const [a,b]=await Promise.all([cmd('begin',key,payload),cmd('begin',key,payload)]);assert.equal(a.id,b.id);
 await assert.rejects(cmd('begin',key,{...payload,slug:'different'}),{code:'23505'});
 await assert.rejects(cmd('begin',crypto.randomUUID(),payload,'11111111-1111-4111-8111-111111111111'),{code:'42501'});
 const lease=crypto.randomUUID();const work=await cmd('claim',lease,{},null);assert.ok(work);
 assert.equal(await cmd('claim',crypto.randomUUID(),{},null),null);
 const uid=work.invitation.auth_user_id;await pool.query('insert into auth.users(id) values($1)',[uid]);
 const token=crypto.randomBytes(32).toString('base64url'),tokenHash=crypto.createHash('sha256').update(token).digest('hex');
 await cmd('bind',work.outbox.id,{lease,userId:uid,tokenHash,encryptedDelivery:'ciphertext'},null);
 assert.equal((await pool.query('select status from profiles where id=$1',[uid])).rows[0].status,'disabled');
 await cmd('failed',work.outbox.id,{lease},null);
 await cmd('retry',work.invitation.id);
 const secondLease=crypto.randomUUID(),retry=await cmd('claim',secondLease,{},null);assert.equal(retry.outbox.encrypted_delivery,'ciphertext');
 await cmd('sent',retry.outbox.id,{lease:secondLease},null);
 await assert.rejects(cmd('reserve_accept',work.invitation.id,{tokenHash:'f'.repeat(64),acceptanceId:crypto.randomUUID()},null),{code:'42501'});
 // Another pending membership must NOT be activated along with this invitation.
 const other='33333333-3333-4333-8333-333333333333';await pool.query("insert into organization_memberships(organization_id,user_id,status) values($1,$2,'invited')",[other,uid]);
 const aid=crypto.randomUUID();const results=await Promise.allSettled([cmd('reserve_accept',work.invitation.id,{tokenHash,acceptanceId:aid},null),cmd('reserve_accept',work.invitation.id,{tokenHash,acceptanceId:crypto.randomUUID()},null)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const accepting=(await pool.query('select acceptance_id from membership_invitations where id=$1',[work.invitation.id])).rows[0].acceptance_id;
 await cmd('finish_accept',work.invitation.id,{acceptanceId:accepting},null);
 const rows=(await pool.query('select organization_id,status from organization_memberships where user_id=$1',[uid])).rows;
 assert.equal(rows.find(x=>x.organization_id===a.organization_id).status,'active');assert.equal(rows.find(x=>x.organization_id===other).status,'invited');
 await assert.rejects(cmd('reserve_accept',work.invitation.id,{tokenHash,acceptanceId:aid},null),{code:'42501'});
 const p2={...payload,slug:'revocation-fixture',adminEmail:'revoke@example.test'};const queued=await cmd('begin',crypto.randomUUID(),p2);
 const invitation=(await pool.query('select id from membership_invitations where job_id=$1',[queued.id])).rows[0].id;
 await cmd('revoke',invitation);await assert.rejects(cmd('inspect',invitation,{tokenHash},null),{code:'42501'});
 await assert.rejects(cmd('retry',invitation),{code:'42501'});
};

module.exports.disableRegression=async(pool,appId)=>{
 const crypto=require('node:crypto');const actor='44444444-4444-4444-8444-444444444444';
 const cmd=async(action,id,data={},who=actor)=>(await pool.query('select provisioning_command($1,$2,$3,$4) data',[who,action,id,data])).rows[0].data;
 await cmd('begin',crypto.randomUUID(),{organizationName:'Explicit disable fixture',slug:'explicit-disable-fixture',adminName:'Pending user',adminEmail:'pending-disabled@example.test',products:[{applicationId:appId,planCode:'standard',status:'active',endsAt:null}]});
 const lease=crypto.randomUUID(),work=await cmd('claim',lease,{},null),uid=work.invitation.auth_user_id;
 await pool.query('insert into auth.users(id) values($1)',[uid]);const tokenHash='a'.repeat(64),aid=crypto.randomUUID();
 await cmd('bind',work.outbox.id,{lease,userId:uid,tokenHash,encryptedDelivery:'ciphertext'},null);await cmd('sent',work.outbox.id,{lease},null);
 await cmd('reserve_accept',work.invitation.id,{tokenHash,acceptanceId:aid},null);
 await pool.query("select set_profile_status($1,$2,'disabled')",[actor,uid]);
 await assert.rejects(cmd('finish_accept',work.invitation.id,{acceptanceId:aid},null),{code:'40001'});
 const row=(await pool.query('select state,token_hash from membership_invitations where id=$1',[work.invitation.id])).rows[0];assert.equal(row.state,'revoked');assert.equal(row.token_hash,null);
 assert.equal((await pool.query('select status from profiles where id=$1',[uid])).rows[0].status,'disabled');
 assert.equal((await pool.query('select state from invitation_outbox where id=$1',[work.outbox.id])).rows[0].state,'revoked');
};
