const crypto=require('node:crypto'),{check}=require('../db');
const {issue,hash,bounded,unavailable}=require('./employee-enrollment');
const command=(client,actor,action,id,data={})=>client.rpc('internal_employee_credentials',{p_actor:actor,p_action:action,p_id:id,p_data:data}).then(check);
const COOKIE='vsph.employee.setup';
async function createTemporary({client,actor,sessionHash,employeeId,rosterVersion,credentialVersion,enrollmentVersion,key,origin}){
 const base=new URL(origin);if(base.username||base.password||(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname))))throw unavailable();
 const review=await command(client,actor,'review',employeeId,{currentHash:sessionHash});
 const password=crypto.randomBytes(24).toString('base64url');let issued;
 if(!review.credential){
  const existing=check(await client.rpc('internal_employee_enrollment',{p_actor:actor,p_action:'review',p_id:employeeId,p_data:{currentHash:sessionHash}}));
  issued=await issue({client,actor,sessionHash,employeeId,rosterVersion,key,origin,...(existing.enrollment?{enrollmentId:existing.enrollment.id,version:enrollmentVersion}:{})});
  if(issued.replayed)return issued;
 }
 const record=await command(client,actor,'begin',employeeId,{currentHash:sessionHash,rosterVersion,temporaryHash:hash(password),...(issued?{enrollmentId:issued.id,enrollmentVersion:issued.version}:{version:credentialVersion})});
 try{
  const found=await bounded(()=>client.auth.admin.getUserById(record.userId)),u=found.data?.user;
  if(found.error||u?.id!==record.userId||u.email?.toLowerCase()!==record.email||u.app_metadata?.vsph_employee_enrollment!==record.enrollmentId||Boolean(u.email_confirmed_at)!==record.reissue||u.factors?.some(f=>f.status==='verified'))throw unavailable();
  const update=await bounded(()=>client.auth.admin.updateUserById(record.userId,{password,email_confirm:true}));
  if(update.error||update.data?.user?.id!==record.userId)throw unavailable();
  await command(client,actor,'ready',record.id,{currentHash:sessionHash,rosterVersion,nonce:record.nonce});
  const login=new URL('/login',origin);
  return {email:record.email,temporaryPassword:password,expiresAt:record.expiresAt,loginUrl:login.toString(),message:'Private temporary credentials. The employee must replace this password before any portal access. No email was sent.'};
 }catch{try{await command(client,null,'failed',record.id,{nonce:record.nonce});}catch{/* Leave an uncertain write quarantined. */}throw unavailable();}
}
async function temporaryLogin({client,user,assurance,setupHash,passwordHash}){
 // Called only after provider password/MFA verification, never from client claims.
 if(!user.app_metadata?.vsph_employee_enrollment)return false;
 try{await command(client,user.id,'login',null,{setupHash,assurance,temporaryHash:passwordHash,verifiedAt:new Date().toISOString()});return true;}
 catch(e){if(['42501','40001','PGRST202','42883'].includes(e.code))return false;throw e;}
}
async function replacePassword({client,setupHash,password}){
 const nonce=crypto.randomUUID(),record=await command(client,null,'reserve',null,{setupHash,temporaryHash:hash(password),nonce});
 try{
  const found=await bounded(()=>client.auth.admin.getUserById(record.userId)),u=found.data?.user;
  if(found.error||u?.id!==record.userId||u.email?.toLowerCase()!==record.email||u.app_metadata?.vsph_employee_enrollment!==record.enrollmentId||!u.email_confirmed_at)throw unavailable();
  if(u.factors?.some(f=>f.status==='verified')&&record.assurance!=='aal2'){await command(client,null,'reject',null,{setupHash,nonce});const e=Error('Authenticator settings changed. Sign in again with your authenticator before changing the password.');e.credentialStepUp=true;throw e;}
  const result=await bounded(()=>client.auth.admin.updateUserById(record.userId,{password}));
  if(result.error&&[400,422].includes(result.error.status)){await command(client,null,'reject',null,{setupHash,nonce});const e=Error('Choose a stronger personal password.');e.enrollmentPassword=true;throw e;}
  if(result.error||result.data?.user?.id!==record.userId)throw unavailable();
  await command(client,null,'finish',null,{setupHash,nonce});
  return {message:'Your personal password is set. Sign in again to open your employee workspace.'};
 }catch(e){if(e.enrollmentPassword||e.credentialStepUp)throw e;try{await command(client,null,'failed',record.id,{nonce});}catch{/* No unsafe retry. */}throw unavailable();}
}
module.exports={COOKIE,command,createTemporary,temporaryLogin,replacePassword};
