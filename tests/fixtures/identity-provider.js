// Isolated test provider only. Never imported by application code or configured
// by an environment flag. It deliberately does not implement real Supabase Auth.
const FACTOR='eeeeeeee-3333-4333-8333-333333333333';
module.exports=function identityFactory(lookup,{mfaEmails=[],events=[]}={}){
 return ()=>{
  let user=null,level='aal1';
  return {auth:{
   async signInWithPassword({email,password}){
    events.push('password');user=await lookup(email);
    if(!user||password!=='fixture-password-only')return {data:{user:null,session:null},error:{status:400}};
    user={...user,factors:mfaEmails.includes(email)?[{id:FACTOR,status:'verified',factor_type:'totp',friendly_name:'Fixture authenticator'}]:[]};
    return {data:{user,session:{access_token:'isolated-provider-session-never-return-to-browser'}},error:null};
   },
   async getUser(){return {data:{user},error:null};},
   mfa:{
    async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:level,nextLevel:user?.factors.length?'aal2':'aal1'},error:null};},
    async listFactors(){return {data:{all:user?.factors||[]},error:null};},
    async challengeAndVerify({factorId,code}){events.push('totp');if(factorId!==FACTOR||code!=='123456')return {data:null,error:{status:400}};level='aal2';return {data:{user},error:null};}
   },
   async signOut(options){if(options.scope!=='local')throw Error('Fixture forbids global logout');events.push('local-signout');user=null;return {error:null};}
  }};
 };
};
module.exports.FACTOR=FACTOR;
