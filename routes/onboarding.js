const express=require('express');
const {db,check}=require('../db');
const router=express.Router();

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

const {rpcRoute}=require('../services/rpc');
router.get('/',rpcRoute(async(req)=>check(await db().rpc('provisioning_command',{p_actor:req.user.id,p_action:'list'}))));
router.post('/',rpcRoute(async(req,res)=>{
 let payload;try{payload=validateOnboarding(req.body)}catch(e){e.validation=true;throw e;}
 const key=req.get('Idempotency-Key');
 if(!validId(key))return res.status(400).json({message:'A UUID Idempotency-Key is required.'});
 const job=check(await db().rpc('provisioning_command',{p_actor:req.user.id,p_action:'begin',p_id:key,p_data:payload}));
 res.status(202);return {...job,id:job.organization_id,organizationName:payload.organizationName,products:payload.products,message:'Customer setup queued. Delivery status is available in provisioning recovery.'};
}));
for(const action of ['retry','revoke','recover'])router.post('/:id/'+action,rpcRoute(async(req,res)=>{
 if(!validId(req.params.id))return res.status(400).json({message:'Invalid invitation ID.'});
 return check(await db().rpc('provisioning_command',{p_actor:req.user.id,p_action:action,p_id:req.params.id,p_data:{reconciled:req.body?.reconciled===true}}));
}));
module.exports={router,validateOnboarding,publicInviteUrl};
