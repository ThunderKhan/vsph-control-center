const express=require('express');
const {db,check}=require('../db');
const router=express.Router();

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=id=>typeof id==='string'&&uuidPattern.test(id);
const errorResponse=(res,status,message)=>res.status(status).json({message});

function validateOnboarding(input,now=Date.now()){
  const organizationName=String(input?.organizationName||'').trim();
  const slug=String(input?.slug||'').trim().toLowerCase();
  const adminName=String(input?.adminName||'').trim();
  const adminEmail=String(input?.adminEmail||'').trim().toLowerCase();
  if(!organizationName||organizationName.length>150||!slugPattern.test(slug)||slug.length>160)
    throw new Error('Provide a valid organization name and URL slug.');
  if(!adminName||adminName.length>150||!emailPattern.test(adminEmail)||adminEmail.length>190)
    throw new Error('Provide the administrator’s full name and valid email.');
  const items=input?.products;
  if(!Array.isArray(items)||!items.length||items.length>12)
    throw new Error('Select between 1 and 12 products.');
  const seen=new Set(),products=items.map(item=>{
    const id=item?.applicationId,planCode=String(item?.planCode||'').trim();
    const status=item?.status;
    if(!validId(id)||seen.has(id)||!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(planCode))
      throw new Error('Every product needs a unique application and a valid plan code.');
    seen.add(id);
    if(!['trial','active'].includes(status))
      throw new Error('Choose a trial or active subscription for each product.');
    const rawEnd=item?.endsAt;
    const parsed=rawEnd?new Date(rawEnd):null;
    if(rawEnd&&(!parsed||Number.isNaN(parsed.getTime())||parsed.getTime()<=now))
      throw new Error('Subscription end dates must be valid future dates.');
    if(status==='trial'&&!parsed)
      throw new Error('Trial subscriptions require an end date.');
    return {applicationId:id,planCode,status,endsAt:parsed?parsed.toISOString():null};
  });
  return {organizationName,slug,adminName,adminEmail,products};
}
function publicInviteUrl(){
  const raw=process.env.PUBLIC_ORIGIN||'http://localhost:3000';
  const url=new URL(raw);
  const loopback=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    (url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&url.protocol==='http:'&&loopback)))
    throw new Error('PUBLIC_ORIGIN must be a safe HTTPS origin (localhost HTTP is allowed in development).');
  return new URL('/accept-invite',url).toString();
}
function isConflict(err){
  return err?.code==='23505'||err?.status===422||/already (registered|exists)|duplicate|unique constraint/i.test(String(err?.message||''));
}
function onboardingDeps(){
  return {db,check};
}

// This endpoint is mounted behind portalSession + requireAdmin in server.js.
// No client-supplied user role, tenant id, or grant status is accepted.
router.post('/',async(req,res,next)=>{
  let data;
  try{data=validateOnboarding(req.body)}catch(err){return errorResponse(res,400,err.message)}
  const {organizationName,slug,adminName,adminEmail,products}=data;
  let orgId=null,invitedUserId=null,hasInvited=false;
  let completed=false;
  try{
    const client=db();
    const apps=check(await client.from('applications').select('id,code,name,status').in('id',products.map(p=>p.applicationId)).eq('status','active'));
    if(apps.length!==products.length)return errorResponse(res,400,'One or more selected products are unavailable.');
    const existing=check(await client.from('profiles').select('id').eq('email',adminEmail).maybeSingle());
    if(existing)return errorResponse(res,409,'This email already belongs to a VSPH account. Use the existing user access controls.');
    const duplicate=check(await client.from('organizations').select('id').eq('slug',slug).maybeSingle());
    if(duplicate)return errorResponse(res,409,'That organization slug is already taken.');
    const redirectTo=publicInviteUrl();
    const org=check(await client.from('organizations').insert({name:organizationName,slug}).select('id').single());
    orgId=org.id;
    const invited=await client.auth.admin.inviteUserByEmail(adminEmail,{
      data:{full_name:adminName},redirectTo
    });
    if(invited.error)throw invited.error;
    if(!invited.data?.user?.id)throw new Error('Invitation service did not return an identity.');
    invitedUserId=invited.data.user.id;hasInvited=true;

    check(await client.from('profiles').insert({
      id:invitedUserId,full_name:adminName,email:adminEmail,status:'active',platform_role:'user'
    }));
    check(await client.from('organization_memberships').insert({
      organization_id:orgId,user_id:invitedUserId,role:'owner',status:'invited'
    }));
    check(await client.from('subscriptions').insert(products.map(p=>({
      organization_id:orgId,application_id:p.applicationId,plan_code:p.planCode,
      status:p.status,ends_at:p.endsAt
    }))));
    check(await client.from('organization_app_access').insert(products.map(p=>({
      organization_id:orgId,application_id:p.applicationId,status:'enabled'
    }))));
    check(await client.from('user_app_roles').insert(products.map(p=>({
      organization_id:orgId,application_id:p.applicationId,user_id:invitedUserId,role_code:'super_admin'
    }))));
    completed=true;
    // Audit after successful provisioning. A temporary logging failure must
    // not destroy an already sent invitation and a correctly provisioned tenant.
    try{check(await client.from('audit_logs').insert({
      actor_user_id:req.user.id,organization_id:orgId,action:'customer.onboarded',
      target_type:'organization',target_id:orgId,
      details:{slug,email:adminEmail,productCodes:apps.map(app=>app.code),inviteStatus:'sent'}
    }))}catch(err){console.error('Onboarding audit write failed',err)}
    return res.status(201).json({
      id:orgId,organizationName,adminEmail,invitationStatus:'sent',
      products:products.map(p=>({applicationId:p.applicationId,planCode:p.planCode,status:p.status,endsAt:p.endsAt})),
      message:'Customer created. Supabase has accepted the administrator invitation.'
    });
  }catch(err){
    // Supabase Auth invitations and REST writes cannot share a transaction.
    // Clean up the new tenant and invited user only, never an existing account.
    const client=db();
    let cleanupFailed=false;
    if(orgId){
      try{const x=await client.from('organizations').delete().eq('id',orgId);if(x.error)throw x.error}
      catch(e){cleanupFailed=true;console.error('Onboarding tenant cleanup failed',e)}
    }
    if(invitedUserId){
      try{const x=await client.from('profiles').delete().eq('id',invitedUserId);if(x.error)throw x.error}
      catch(e){cleanupFailed=true;console.error('Onboarding profile cleanup failed',e)}
      try{const x=await client.auth.admin.deleteUser(invitedUserId);if(x.error)throw x.error}
      catch(e){cleanupFailed=true;console.error('Onboarding auth cleanup failed',e)}
    }
    if(cleanupFailed)return errorResponse(res,500,'Onboarding could not complete and requires administrator cleanup. Check server logs before retrying.');
    if(isConflict(err))return errorResponse(res,409,'An organization or administrator with these details already exists.');
    if(hasInvited)return errorResponse(res,500,'Provisioning failed after the invitation was requested. The invitation may be invalidated; check email and retry.');
    if(err?.message==='Invitation service did not return an identity.')
      return errorResponse(res,502,err.message);
    return next(err);
  }
});

module.exports={router,validateOnboarding,publicInviteUrl};
