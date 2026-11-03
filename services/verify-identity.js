const {publicAuth}=require('../db');
const {uuid}=require('./rpc');
class IdentityError extends Error{
 constructor(status,code,message,factors){super(message);this.status=status;this.code=code;if(factors)this.factors=factors;}
}
const unavailable=()=>new IdentityError(503,'AUTH_UNAVAILABLE','Identity verification is temporarily unavailable. Try again later.');
function validateCredentials({email,password,totpCode='',totpFactorId}={}){
 if(typeof email!=='string'||!email.trim()||email.length>254||typeof password!=='string'||!password||password.length>4096||typeof totpCode!=='string'||(totpCode!==''&&!/^\d{6}$/.test(totpCode))||(totpFactorId!==undefined&&!uuid(totpFactorId)))throw new IdentityError(400,'INVALID_CREDENTIAL_FIELDS','Provide your email, password and a six-digit authenticator code when requested.');
 return {email:email.trim().toLowerCase(),password,totpCode,totpFactorId};
}
async function verifyIdentity(input,{client,expectedUserId}={}){
 const credentials=validateCredentials(input);let auth,hasSession=false;
 try{
  auth=(client||publicAuth()).auth;
  const signed=await auth.signInWithPassword({email:credentials.email,password:credentials.password});
  hasSession=Boolean(signed.data?.session?.access_token);
  if(signed.error){
   if(signed.error.status===429)throw new IdentityError(429,'AUTH_RATE_LIMITED','Too many authentication attempts. Try again later.');
   if(!signed.error.status||signed.error.status>=500)throw unavailable();
   throw new IdentityError(401,'INVALID_CREDENTIALS','Invalid credentials or email not confirmed.');
  }
  if(!hasSession||!signed.data?.user?.id)throw unavailable();
  const current=await auth.getUser();
  const user=current.data?.user;
  if(current.error||!user?.id)throw unavailable();
  if(user.id!==signed.data.user.id||user.email?.toLowerCase()!==credentials.email||(expectedUserId&&user.id!==expectedUserId))throw new IdentityError(401,'IDENTITY_MISMATCH','Use your signed-in account to verify this action.');
  const level=await auth.mfa.getAuthenticatorAssuranceLevel();
  if(level.error||!['aal1','aal2'].includes(level.data?.currentLevel)||!['aal1','aal2'].includes(level.data?.nextLevel))throw unavailable();
  let assurance=level.data.currentLevel;
  const requiresMfa=level.data.nextLevel==='aal2'||user.factors?.some(f=>f.status==='verified');
  if(requiresMfa&&assurance!=='aal2'){
   const listed=await auth.mfa.listFactors();
   if(listed.error||!Array.isArray(listed.data?.all))throw unavailable();
   const totp=listed.data.all.filter(f=>f.factor_type==='totp'&&f.status==='verified'&&uuid(f.id)).sort((a,b)=>a.id.localeCompare(b.id));
   if(!totp.length)throw new IdentityError(403,'MFA_METHOD_UNSUPPORTED','This account requires a second factor that this portal cannot verify. Contact your administrator; password-only access is denied.');
   const factors=totp.map(f=>({id:f.id,name:String(f.friendly_name||'Authenticator').slice(0,80)}));
   if(!credentials.totpCode||(!credentials.totpFactorId&&totp.length>1))throw new IdentityError(401,'MFA_REQUIRED','Enter the current code from your enrolled authenticator.',factors);
   const factor=totp.find(f=>f.id===(credentials.totpFactorId||totp[0].id));
   if(!factor)throw new IdentityError(401,'MFA_INVALID','Authenticator verification failed. Try a current code.');
   const verified=await auth.mfa.challengeAndVerify({factorId:factor.id,code:credentials.totpCode});
   if(verified.error){if(!verified.error.status||verified.error.status>=500)throw unavailable();throw new IdentityError(401,'MFA_INVALID','Authenticator verification failed. Try a current code.');}
   const after=await auth.mfa.getAuthenticatorAssuranceLevel();
   const verifiedUser=await auth.getUser();
   if(after.error||after.data?.currentLevel!=='aal2'||verifiedUser.error||verifiedUser.data?.user?.id!==user.id)throw unavailable();
   assurance='aal2';
  }
  return {user,assurance};
 }catch(error){if(error instanceof IdentityError)throw error;throw unavailable();}
 finally{
  // Never use the default global sign-out: this isolated verification session
  // must not revoke the user's other provider sessions. No provider JWT persists.
  if(hasSession){try{const result=await auth.signOut({scope:'local'});if(result.error)throw unavailable();}catch{throw unavailable();}}
 }
}
function identityFailure(error,res){
 if(!(error instanceof IdentityError))return false;
 if(error.status===429)res.set('Retry-After','60');
 res.status(error.status).json({code:error.code,message:error.message,...(error.factors?{factors:error.factors}:{})});return true;
}
module.exports={verifyIdentity,validateCredentials,IdentityError,identityFailure};
