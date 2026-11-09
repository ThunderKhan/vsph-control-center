const express=require('express');
const {db,check}=require('../db');
const router=express.Router();

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=id=>typeof id==='string'&&uuidPattern.test(id);
const errorResponse=(res,status,message)=>res.status(status).json({message});

function validateOnboarding(input,now=Date.now()){
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).length!==5||
     !['organizationName','slug','adminName','adminEmail','products'].every(k=>Object.hasOwn(input,k)))
    throw new Error('Review the required organization fields.');
  for(const key of ['organizationName','slug','adminName','adminEmail'])
    if(typeof input[key]!=='string')throw new Error('Organization and owner details must be text.');
  const organizationName=input.organizationName.trim();
  const slug=input.slug.trim().toLowerCase();
  const adminName=input.adminName.trim();
  const adminEmail=input.adminEmail.trim().toLowerCase();
  if(organizationName.length<2||organizationName.length>150||
    /[\u0000-\u001f\u007f]/.test(organizationName)||
    !slugPattern.test(slug)||slug.length>160)
    throw new Error('Provide a valid organization name and URL slug.');
  if(adminName.length<2||adminName.length>150||/[\u0000-\u001f\u007f]/.test(adminName)||
     adminEmail.length>190||!emailPattern.test(adminEmail))
    throw new Error('Provide an owner name and valid email address.');
  if(!Array.isArray(input.products)||input.products.length>12)
    throw new Error('Choose no more than 12 catalog products.');
  const ids=new Set(),products=input.products.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item)||
      Object.keys(item).length!==4||
      !['applicationId','planCode','status','endsAt'].every(k=>Object.hasOwn(item,k))||
      typeof item.planCode!=='string')throw new Error('Review the product subscription fields.');
    const applicationId=item.applicationId,planCode=item.planCode.trim().toLowerCase();
    if(!validId(applicationId)||ids.has(applicationId)||
       !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(planCode))
      throw new Error('Every product needs a unique application and a valid plan code.');
    ids.add(applicationId);
    if(!['trial','active'].includes(item.status))
      throw new Error('Choose a trial or active subscription for each product.');
    if(item.endsAt!==null&&(typeof item.endsAt!=='string'||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(item.endsAt)))
      throw new Error('Use a valid subscription end date.');
    const parsed=item.endsAt===null?null:new Date(item.endsAt);
    if(parsed&&(!Number.isFinite(parsed.getTime())||parsed.getTime()<=now))
      throw new Error('Subscription end dates must be future dates.');
    if(item.status==='trial'&&!parsed)
      throw new Error('Trial subscriptions require an end date.');
    return {applicationId,planCode,status:item.status,endsAt:parsed?parsed.toISOString():null};
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
router.get('/availability',rpcRoute(async(req)=>{
  if(Object.keys(req.query).length!==1||typeof req.query.slug!=='string'||
     !slugPattern.test(req.query.slug)||req.query.slug.length>160){
    const e=Error('Enter a valid organization slug.');e.validation=true;throw e;
  }
  const existing=check(await db().from('organizations').select('id').eq('slug',req.query.slug).maybeSingle());
  return {available:!existing,slug:req.query.slug};
}));
router.get('/requests/:key',rpcRoute(async(req)=>{
  if(!validId(req.params.key)||Object.keys(req.query).length){
    const e=Error('Use a valid request identifier.');e.validation=true;throw e;
  }
  const request=check(await db().from('provisioning_jobs')
    .select('id,organization_id,state,created_at')
    .eq('actor_id',req.user.id).eq('idempotency_key',req.params.key).maybeSingle());
  if(!request)return {found:false};
  const org=check(await db().from('organizations').select('id,name,slug')
    .eq('id',request.organization_id).maybeSingle());
  if(!org)return {found:false};
  return {found:true,id:org.id,organizationName:org.name,slug:org.slug,jobId:request.id,
    state:request.state,createdAt:request.created_at};
}));
router.post('/',rpcRoute(async(req,res)=>{
 let payload;try{payload=validateOnboarding(req.body)}catch(e){e.validation=true;throw e;}
 const key=req.get('Idempotency-Key');
 if(!validId(key))return res.status(400).json({message:'A UUID Idempotency-Key is required.'});
 const job=check(await db().rpc(payload.products.length?'provisioning_command':'organization_only_onboarding',
  payload.products.length?{p_actor:req.user.id,p_action:'begin',p_id:key,p_data:payload}:
  {p_actor:req.user.id,p_request_id:key,p_data:payload}));
 res.status(202);return {...job,id:job.organization_id,organizationName:payload.organizationName,products:payload.products,message:'Customer setup queued. Delivery status is available in provisioning recovery.'};
}));
for(const action of ['retry','revoke','recover','reissue'])router.post('/:id/'+action,rpcRoute(async(req,res)=>{
 if(!validId(req.params.id))return res.status(400).json({message:'Invalid invitation ID.'});
 return check(await db().rpc('provisioning_command',{p_actor:req.user.id,p_action:action,p_id:req.params.id,p_data:{reconciled:req.body?.reconciled===true,generation:req.body?.generation}}));
}));
module.exports={router,validateOnboarding,publicInviteUrl};
