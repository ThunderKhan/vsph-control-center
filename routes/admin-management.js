const express=require('express');
const {db,check}=require('../db');
const router=express.Router();
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern=/^[a-z0-9]+(-[a-z0-9]+)*$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reqUuid=x=>uuidPattern.test(String(x||''));
const query=async(table,fields='*')=>check(await db().from(table).select(fields));
const nowISO=()=>new Date().toISOString();
const timeValue=x=>x?(new Date(x).toString()==='Invalid Date'?null:new Date(x).toISOString()):null;
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
async function audit(req,action,target_type,target_id,details={},organization_id=null){
 check(await db().from('audit_logs').insert({actor_user_id:req.user.id,organization_id,action,target_type,target_id:String(target_id||''),details}));
}
const withCounts=async table=>{const{count,error}=await db().from(table).select('*',{count:'exact',head:true});if(error)throw error;return count};
router.get('/overview',asyncRoute(async(req,res)=>{
 const[organizations,users,applications,subs,access]=await Promise.all([
 withCounts('organizations'),withCounts('profiles'),withCounts('applications'),
 query('subscriptions','status'),query('organization_app_access','status')]);
 res.json({organizations,users,applications,activeSubscriptions:subs.filter(s=>['active','trial'].includes(s.status)).length,enabledAppAccess:access.filter(x=>x.status==='enabled').length});
}));
router.get('/lookups',asyncRoute(async(req,res)=>{
 const [organizations,applications]=await Promise.all([query('organizations','id,name,slug,status'),query('applications','id,name,code,status')]);
 res.json({organizations:organizations.filter(o=>o.status==='active'),applications:applications.filter(a=>a.status==='active')});
}));
router.get('/organizations',asyncRoute(async(req,res)=>{
 const [organizations,memberships]=await Promise.all([query('organizations'),query('organization_memberships','organization_id')]);
 res.json({organizations:organizations.map(o=>({...o,member_count:memberships.filter(m=>m.organization_id===o.id).length})).sort((a,b)=>b.created_at.localeCompare(a.created_at))});
}));
router.post('/organizations',asyncRoute(async(req,res)=>{
 const name=String(req.body.name||'').trim(),slug=String(req.body.slug||'').toLowerCase().trim();
 if(!name||!slugPattern.test(slug))return res.status(400).json({message:'Valid name and slug are required.'});
 const org=check(await db().from('organizations').insert({name,slug}).select('id').single());
 await audit(req,'organization.created','organization',org.id,{name,slug});res.status(201).json({id:org.id});
}));
router.patch('/organizations/:id/status',asyncRoute(async(req,res)=>{
 const status=String(req.body.status||'');if(!['active','suspended','closed'].includes(status)||!reqUuid(req.params.id))return res.status(400).json({message:'Invalid status or ID.'});
 const result=check(await db().from('organizations').update({status}).eq('id',req.params.id).select('id').maybeSingle());
 if(!result)return res.status(404).json({message:'Organization not found.'});
 await audit(req,'organization.status_changed','organization',result.id,{status});res.json({message:'Status updated.'});
}));
router.get('/users',asyncRoute(async(req,res)=>{
 const [users,memberships,organizations]=await Promise.all([query('profiles'),query('organization_memberships','user_id,organization_id'),query('organizations','id,name')]);
 const names=new Map(organizations.map(o=>[o.id,o.name]));
 res.json({users:users.map(u=>({...u,organizations:memberships.filter(m=>m.user_id===u.id).map(m=>names.get(m.organization_id)).filter(Boolean).join(', ')})).sort((a,b)=>b.created_at.localeCompare(a.created_at))});
}));
// Legacy password/elevation endpoints are retired, including for platform admins.
function retiredProvisioning(req,res){
 res.set('Deprecation','true');res.set('Link','</admin/onboarding>; rel="successor-version"');
 return res.status(410).json({message:'Password-based provisioning is retired. Use customer onboarding email invitations. Standalone user invitations and platform elevation require the governed identity workflow.'});
}
router.post('/users',retiredProvisioning);
router.patch('/users/:id/status',asyncRoute(async(req,res)=>{
 const status=String(req.body.status||'');if(!reqUuid(req.params.id)||!['active','disabled'].includes(status))return res.status(400).json({message:'Invalid user or status.'});
 if(req.params.id===req.user.id&&status==='disabled')return res.status(400).json({message:'You cannot disable yourself.'});
 const result=await db().rpc('set_profile_status',{p_actor:req.user.id,p_target:req.params.id,p_status:status});
 if(result.error){
  const code=result.error.code;
  if(code==='P0002')return res.status(404).json({message:'User not found.'});
  if(code==='VS001')return res.status(409).json({message:'Platform administrator lifecycle changes require a governed security workflow.'});
  if(code==='42501')return res.status(403).json({message:'Platform administrator access is no longer active.'});
  if(code==='22023')return res.status(400).json({message:'Account status change is not permitted.'});
  throw result.error;
 }
 res.json({message:'User updated. Existing sessions were revoked when disabling the account.'});
}));
router.get('/applications',asyncRoute(async(req,res)=>res.json({applications:(await query('applications')).sort((a,b)=>a.name.localeCompare(b.name))})));
router.post('/applications',asyncRoute(async(req,res)=>{
 const code=String(req.body.code||'').toUpperCase().trim(),name=String(req.body.name||'').trim(),login_path=String(req.body.loginPath||'').trim(),status=String(req.body.status||'active');
 if(!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)||!name||!/^\/apps\/[a-z0-9-]+\/login$/.test(login_path)||!['active','maintenance','retired'].includes(status))return res.status(400).json({message:'Invalid application details.'});
 const app=check(await db().from('applications').insert({code,name,login_path,status}).select('id').single());
 check(await db().from('app_roles').insert(['super_admin','admin','manager','user','viewer'].map(r=>({application_id:app.id,code:r,name:r.replace('_',' ')}))));
 await audit(req,'application.created','application',app.id,{code,name});res.status(201).json({id:app.id});
}));
router.patch('/applications/:id',asyncRoute(async(req,res)=>{
 const name=String(req.body.name||'').trim(),login_path=String(req.body.loginPath||'').trim(),status=String(req.body.status||'');
 if(!reqUuid(req.params.id)||!name||!/^\/apps\/[a-z0-9-]+\/login$/.test(login_path)||!['active','maintenance','retired'].includes(status))return res.status(400).json({message:'Invalid application details.'});
 const item=check(await db().from('applications').update({name,login_path,status}).eq('id',req.params.id).select('id').maybeSingle());
 if(!item)return res.status(404).json({message:'Application not found.'});
 await audit(req,'application.updated','application',item.id,{name,status});res.json({message:'Application updated.'});
}));
router.get('/subscriptions',asyncRoute(async(req,res)=>{
 const [subs,orgs,apps]=await Promise.all([query('subscriptions'),query('organizations','id,name'),query('applications','id,name,code')]);
 const orgNames=new Map(orgs.map(o=>[o.id,o.name])),appNames=new Map(apps.map(a=>[a.id,a]));
 res.json({subscriptions:subs.map(s=>({...s,organization_name:orgNames.get(s.organization_id),application_name:appNames.get(s.application_id)?.name,application_code:appNames.get(s.application_id)?.code})).sort((a,b)=>b.created_at.localeCompare(a.created_at))});
}));
router.put('/subscriptions',asyncRoute(async(req,res)=>{
 const organization_id=String(req.body.organizationId||''),application_id=String(req.body.applicationId||''),status=String(req.body.status||''),plan_code=String(req.body.planCode||'prototype').slice(0,60),ends_at=timeValue(req.body.endsAt);
 if(!reqUuid(organization_id)||!reqUuid(application_id)||!['trial','active','past_due','cancelled','expired'].includes(status)||(req.body.endsAt&&!ends_at))return res.status(400).json({message:'Invalid subscription.'});
 check(await db().from('subscriptions').upsert({organization_id,application_id,status,plan_code,ends_at},{onConflict:'organization_id,application_id'}));
 await audit(req,'subscription.saved','subscription',`${organization_id}/${application_id}`,{status});res.json({message:'Subscription saved.'});
}));
router.get('/access',asyncRoute(async(req,res)=>{
 const [grants,orgs,apps]=await Promise.all([query('organization_app_access'),query('organizations','id,name'),query('applications','id,name,code')]);
 const orgNames=new Map(orgs.map(o=>[o.id,o.name])),appNames=new Map(apps.map(a=>[a.id,a]));
 res.json({access:grants.map(g=>({...g,organization_name:orgNames.get(g.organization_id),application_name:appNames.get(g.application_id)?.name,application_code:appNames.get(g.application_id)?.code}))});
}));
router.put('/access',asyncRoute(async(req,res)=>{
 const organization_id=String(req.body.organizationId||''),application_id=String(req.body.applicationId||''),status=String(req.body.status||'');
 if(!reqUuid(organization_id)||!reqUuid(application_id)||!['enabled','suspended','revoked'].includes(status))return res.status(400).json({message:'Invalid application grant.'});
 check(await db().from('organization_app_access').upsert({organization_id,application_id,status},{onConflict:'organization_id,application_id'}));
 await audit(req,'access.saved','app_grant',`${organization_id}/${application_id}`,{status});res.json({message:'Application access saved.'});
}));
router.get('/roles',asyncRoute(async(req,res)=>{
 const [roles,orgs,apps,users]=await Promise.all([query('user_app_roles'),query('organizations','id,name'),query('applications','id,code'),query('profiles','id,email')]);
 const orgNames=new Map(orgs.map(x=>[x.id,x.name])),appCodes=new Map(apps.map(x=>[x.id,x.code])),emails=new Map(users.map(x=>[x.id,x.email]));
 res.json({roles:roles.map(r=>({...r,organization_name:orgNames.get(r.organization_id),application_code:appCodes.get(r.application_id),email:emails.get(r.user_id)}))});
}));
router.put('/roles',asyncRoute(async(req,res)=>{
 const organization_id=String(req.body.organizationId||''),application_id=String(req.body.applicationId||''),email=String(req.body.email||'').trim().toLowerCase(),role_code=String(req.body.role||'');
 if(!reqUuid(organization_id)||!reqUuid(application_id)||!emailPattern.test(email)||
    !['super_admin','admin','manager','user','viewer','staff','musician'].includes(role_code))
    return res.status(400).json({message:'Invalid role assignment.'});
 const selectedApp=check(await db().from('applications').select('code').eq('id',application_id).maybeSingle());
 if(!selectedApp)return res.status(404).json({message:'Application not found.'});
 if(['staff','musician'].includes(role_code)&&selectedApp.code!=='MUSIC')
    return res.status(400).json({message:'Staff and musician roles are only available for Music.'});
 const user=check(await db().from('profiles').select('id').eq('email',email).eq('status','active').maybeSingle());
 if(!user)return res.status(404).json({message:'User not found. Create the user first.'});
 const grant=check(await db().from('organization_app_access').select('status').eq('organization_id',organization_id).eq('application_id',application_id).maybeSingle());
 if(!grant)return res.status(400).json({message:'Grant the organization application access before assigning roles.'});
 check(await db().from('organization_memberships').upsert({organization_id,user_id:user.id,role:'member',status:'active'},{onConflict:'organization_id,user_id',ignoreDuplicates:true}));
 check(await db().from('user_app_roles').upsert({organization_id,application_id,user_id:user.id,role_code},{onConflict:'organization_id,user_id,application_id'}));
 await audit(req,'role.assigned','user',user.id,{role_code,application_id},organization_id);res.json({message:'Application role saved.'});
}));
router.get('/audit-logs',asyncRoute(async(req,res)=>{
 const [logs,users,orgs]=await Promise.all([check(await db().from('audit_logs').select('*').order('created_at',{ascending:false}).limit(200)),query('profiles','id,full_name'),query('organizations','id,name')]);
 const names=new Map(users.map(x=>[x.id,x.full_name])),orgNames=new Map(orgs.map(x=>[x.id,x.name]));
 res.json({logs:logs.map(l=>({...l,actor_name:names.get(l.actor_user_id),organization_name:orgNames.get(l.organization_id)}))});
}));
router.post('/clients',retiredProvisioning);
module.exports=router;

