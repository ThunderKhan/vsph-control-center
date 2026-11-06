const crypto=require('node:crypto');
const {check}=require('../db');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function unavailable(){const e=Error('Employee account setup is incomplete. Refresh the employee account page to review recovery or reissue options.');e.enrollmentProvider=true;return e;}
async function bounded(operation){let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),15000);})]);}finally{clearTimeout(timer);}}
async function provision(client,record){
 try{
  let found=await bounded(()=>client.auth.admin.getUserById(record.authUserId));
  if(found.error&&found.error.status!==404)throw unavailable();
  if(!found.data?.user){found=await bounded(()=>client.auth.admin.createUser({id:record.authUserId,email:record.email,password:crypto.randomBytes(48).toString('base64url'),email_confirm:false,app_metadata:{vsph_employee_enrollment:record.id}}));}
  const u=found.data?.user;
  if(found.error||u?.id!==record.authUserId||u.email?.toLowerCase()!==record.email||u.app_metadata?.vsph_employee_enrollment!==record.id||u.email_confirmed_at)throw unavailable();
 }catch{throw unavailable();}
}
function command(client,actor,action,id,data={}){return client.rpc('internal_employee_enrollment',{p_actor:actor,p_action:action,p_id:id,p_data:data}).then(check);}
async function issue({client,actor,sessionHash,employeeId,enrollmentId,version,rosterVersion,key,origin}){
 const base=new URL(origin);if(base.username||base.password||(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname))))throw unavailable();
 const token=crypto.randomBytes(32).toString('base64url');
 const data={currentHash:sessionHash,confirmed:true,rosterVersion,tokenHash:hash(token),...(enrollmentId?{version}:{key})};
 const record=await command(client,actor,enrollmentId?'renew':'start',enrollmentId||employeeId,data);
 if(record.replayed)return {id:record.id,replayed:true,message:'This issuance was already recorded. Refresh and explicitly reissue to obtain a new private link.'};
 await provision(client,record);
 await command(client,actor,'ready',record.id,{currentHash:sessionHash,confirmed:true,rosterVersion,version:record.version});
 const link=new URL('/employee-enrollment',base);link.hash=new URLSearchParams({enrollment_id:record.id,token}).toString();
 return {id:record.id,url:link.toString(),delivery:'private_manual_handoff',message:'Share this private link only with the named employee through a trusted channel. No email was sent. The employee chooses their password; HR authority is not granted.'};
}
async function accept({client,id,token,password}){
 const acceptanceId=crypto.randomUUID(),proof={tokenHash:hash(token),acceptanceId};
 const record=await command(client,null,'reserve',id,proof);
 try{
  // A single durable reservation protects an external password write. Never
  // recycle an ambiguous reservation: an old provider request could finish late.
  const found=await bounded(()=>client.auth.admin.getUserById(record.authUserId));
  const user=found.data?.user;
  if(found.error||user?.id!==record.authUserId||user.email?.toLowerCase()!==record.email||user.app_metadata?.vsph_employee_enrollment!==id||user.email_confirmed_at||user.factors?.some(f=>f.status==='verified'))throw unavailable();
  const updated=await bounded(()=>client.auth.admin.updateUserById(record.authUserId,{password,email_confirm:true}));
  if(updated.error&&[400,422].includes(updated.error.status)){await command(client,null,'reject',id,proof);const e=Error('The authentication provider rejected this password. Choose a stronger password and try again.');e.enrollmentPassword=true;throw e;}
  if(updated.error||updated.data?.user?.id!==record.authUserId)throw unavailable();
  await command(client,null,'finish',id,proof);
  return {message:'Your employee account is ready. Sign in with your work email and the password you just chose.'};
 }catch(error){
  if(error.enrollmentPassword)throw error;
  try{await command(client,null,'failed',id,proof);}catch{/* An ambiguous acceptance stays locked and disabled for reconciliation. */}
  throw unavailable();
 }
}
module.exports={issue,accept,command,hash,provision};
