// Explicit operator setup for REAL Auth accounts. Never imported by HTTP routes.
const {randomUUID,createHash}=require('node:crypto');
const {check}=require('../db');
const {hashToken,newToken}=require('../tokens');
const {uuid}=require('./rpc');
function stableId(run,label){const hex=createHash('sha256').update(run+':'+label).digest('hex');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);}
const roles=['hr','employee','customer'];
function validateState(state){
 if(!state||!uuid(state.runId)||!/^\d{4}-\d{2}-\d{2}$/.test(state.startDate)||roles.some(role=>typeof state.passwords?.[role]!=='string'||state.passwords[role].length<24))throw Error('Invalid private setup state.');
}
async function setupRoleAccounts({database,ownerId,ownerSessionHash,state,verify}){
 validateState(state);
 const one=async(table,fields,filters)=>{let q=database.from(table).select(fields);for(const [k,v] of Object.entries(filters))q=q.eq(k,v);return check(await q.maybeSingle());};
 const insert=async(table,row)=>{const r=await database.from(table).insert(row);if(r.error&&r.error.code!=='23505')throw r.error;};
 const command=async(name,actor,action,id,data)=>check(await database.rpc(name,{p_actor:actor,p_action:action,p_id:id,p_data:data}));
 const owner=await one('profiles','id,email,platform_role,status',{id:ownerId});
 if(owner?.platform_role!=='super_admin'||owner.status!=='active')throw Error('A current platform owner is required.');
 await command('internal_employee_identity',ownerId,'inbox',null,{currentHash:ownerSessionHash});
 const identities={};
 for(const role of roles){
  const email='vsph-test-'+state.runId+'-'+role+'@example.test';let user;
  // Bounded discovery resolves an ambiguous create response without taking over
  // an existing account. Only server-owned app_metadata identifies this run.
  for(let page=1;page<=20;page++){
   const r=await database.auth.admin.listUsers({page,perPage:100});if(r.error)throw Error('Auth user discovery unavailable; retry the same private file.');
   user=r.data.users.find(u=>u.email?.toLowerCase()===email);if(user||r.data.users.length<100)break;
   if(page===20)throw Error('Auth discovery exceeded 2000 users; use governed provider recovery.');
  }
  if(!user){const r=await database.auth.admin.createUser({email,password:state.passwords[role],email_confirm:true,app_metadata:{vsph_test_run:state.runId,vsph_test_role:role,vsph_test_owner:ownerId}});if(r.error)throw Error('Auth creation incomplete; retry the same private file. No existing account password was changed.');user=r.data.user;}
  if(user?.app_metadata?.vsph_test_run!==state.runId||user.app_metadata.vsph_test_role!==role||user.app_metadata.vsph_test_owner!==ownerId)throw Error('Account collision: foreign identity will not be modified.');
  if(!uuid(user.id))throw Error('Provider returned an invalid identity.');
  let profile=await one('profiles','id,email,status,platform_role',{id:user.id});
  if(!profile){await insert('profiles',{id:user.id,email,full_name:'VSPH Test '+role,platform_role:'user',status:'active'});profile=await one('profiles','id,email,status,platform_role',{id:user.id});}
  if(profile?.id!==user.id||profile.email!==email||profile.platform_role!=='user'||profile.status!=='active')throw Error('Profile changed; review it without overwriting existing permissions.');
  await verify({email,password:state.passwords[role]},{expectedUserId:user.id});
  identities[role]={id:user.id,email,password:state.passwords[role]};
  await insert('audit_logs',{id:stableId(state.runId,'audit-'+role),actor_user_id:ownerId,action:'operator.role_test_identity',target_type:'profile',target_id:user.id,details:{runId:state.runId,role}});
 }
 for(const role of ['hr','employee']){
  const u=identities[role],data={fullName:'VSPH Test '+role,email:u.email,department:'Test workforce',jobTitle:role==='hr'?'Test HR manager':'Test employee',employmentType:'full_time',startDate:state.startDate};
  const roster=await command('internal_employee_command',ownerId,'create',stableId(state.runId,role),data);
  let e=await one('internal_employees','*',{id:roster.id});
  if(e.email!==u.email||e.created_by!==ownerId)throw Error('Roster collision requires review.');
  if(e.status==='onboarding'){const edit={...data};delete edit.email;await command('internal_employee_command',ownerId,'update',e.id,{...edit,status:'active',version:e.version,confirmed:true});e=await one('internal_employees','*',{id:e.id});}
  if(e.status!=='active')throw Error('Test employee was changed; no automatic reactivation.');
  const review=await command('internal_employee_identity',ownerId,'manage',e.id,{currentHash:ownerSessionHash});
  if(review.link?.status!=='linked'){
   const request=await command('internal_employee_identity',ownerId,'request',e.id,{currentHash:ownerSessionHash,key:stableId(state.runId,'consent-'+role),rosterVersion:e.version,confirmed:true});
   const verified=await verify({email:u.email,password:u.password},{expectedUserId:u.id});
   const token=newToken(),hash=hashToken(token);
   check(await database.from('portal_sessions').insert({token_hash:hash,user_id:u.id,expires_at:new Date(Date.now()+300000).toISOString()}));
   try{const inbox=await command('internal_employee_identity',u.id,'inbox',null,{currentHash:hash}),pending=inbox.requests.find(r=>r.id===request.id);if(!pending||pending.roster_version!==e.version)throw Error('Consent request expired or changed; review in employee identity governance.');await command('internal_employee_identity',u.id,'accept',request.id,{currentHash:hash,rosterVersion:e.version,requestVersion:pending.version,confirmed:true,verifiedAt:new Date().toISOString(),assurance:verified.assurance});}
   finally{check(await database.from('portal_sessions').delete().eq('token_hash',hash));}
  }
  if(role==='hr'&&!await one('internal_hr_managers','employee_id',{employee_id:e.id}))await command('internal_employee_identity',ownerId,'grant_hr',e.id,{currentHash:ownerSessionHash,rosterVersion:e.version,confirmed:true});
 }
 const organizationId=stableId(state.runId,'customer-organization'),slug='vsph-test-'+state.runId;
 await insert('organizations',{id:organizationId,name:'VSPH Test customer',slug,status:'active'});
 const org=await one('organizations','id,slug,status',{id:organizationId});if(org?.slug!==slug||org.status!=='active')throw Error('Test organization changed; review required.');
 await insert('organization_memberships',{organization_id:organizationId,user_id:identities.customer.id,role:'owner',status:'active'});
 const member=await one('organization_memberships','role,status',{organization_id:organizationId,user_id:identities.customer.id});if(member?.role!=='owner'||member.status!=='active')throw Error('Test membership changed; review required.');
 await insert('audit_logs',{id:stableId(state.runId,'audit-org'),actor_user_id:ownerId,organization_id:organizationId,action:'operator.role_test_customer',target_type:'organization',target_id:organizationId,details:{runId:state.runId}});
 return {owner:{email:owner.email,password:'Use your existing owner password; it was not changed.'},...identities,organizationId};
}
module.exports={setupRoleAccounts,stableId,validateState,roles,randomUUID};
