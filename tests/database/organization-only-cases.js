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
 const browser=await pool.connect();
 try{
  for(const role of ['anon','authenticated']){
   await browser.query('set role '+role);
   await assert.rejects(browser.query('select public.organization_only_onboarding($1,$2,$3)',[owner,randomUUID(),payload]),{code:'42501'});
   await browser.query('reset role');
  }
 }finally{await browser.query('reset role');browser.release();}
};
