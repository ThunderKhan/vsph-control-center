const test=require('node:test'),assert=require('node:assert/strict');
const {verifyIdentity,IdentityError}=require('../services/verify-identity');
const factory=require('./fixtures/identity-provider'),{FACTOR}=factory;
const user={id:'11111111-1111-4111-8111-111111111111',email:'identity@fixture.test'};
const credentials={email:user.email,password:'fixture-password-only'};
function client(mfa=true){const events=[];return {events,client:factory(async()=>user,{mfaEmails:mfa?[user.email]:[],events})()};}
test('password-only identities verify without fabricating MFA and clean up only their temporary provider session',async()=>{
 const c=client(false),result=await verifyIdentity(credentials,c);assert.equal(result.user.id,user.id);assert.equal(result.assurance,'aal1');assert.deepEqual(c.events,['password','local-signout']);
});
test('enrolled factors require TOTP and return only public factor metadata',async()=>{
 const c=client();await assert.rejects(verifyIdentity(credentials,c),e=>e.code==='MFA_REQUIRED'&&e.status===401&&e.factors[0].id===FACTOR&&!JSON.stringify(e).includes('provider-session'));assert.deepEqual(c.events,['password','local-signout']);
});
test('valid TOTP must result in provider aal2; wrong code cannot authenticate',async()=>{
 const good=client();assert.equal((await verifyIdentity({...credentials,totpCode:'123456',totpFactorId:FACTOR},good)).assurance,'aal2');assert.deepEqual(good.events,['password','totp','local-signout']);
 const bad=client();await assert.rejects(verifyIdentity({...credentials,totpCode:'000000'},bad),{code:'MFA_INVALID'});assert.equal(bad.events.at(-1),'local-signout');
});
test('unlisted factors cannot be selected by request and multiple factors require explicit selection',async()=>{
 const c=client();await assert.rejects(verifyIdentity({...credentials,totpCode:'123456',totpFactorId:user.id},c),{code:'MFA_INVALID'});assert.ok(!c.events.includes('totp'));
 const multiple=client();multiple.client.auth.mfa.listFactors=async()=>({data:{all:[{id:FACTOR,status:'verified',factor_type:'totp'},{id:user.id,status:'verified',factor_type:'totp'}]},error:null});await assert.rejects(verifyIdentity({...credentials,totpCode:'123456'},multiple),{code:'MFA_REQUIRED'});
});
test('unsupported or unverified second factors never fall back to password-only access',async()=>{
 for(const factor of [{id:FACTOR,status:'verified',factor_type:'phone'},{id:FACTOR,status:'unverified',factor_type:'totp'}]){
  const c=client();c.client.auth.mfa.listFactors=async()=>({data:{all:[factor]},error:null});await assert.rejects(verifyIdentity({...credentials,totpCode:'123456'},c),{code:'MFA_METHOD_UNSUPPORTED'});
 }
});
test('identity mismatch, missing provider session and stale verification cannot authenticate',async()=>{
 await assert.rejects(verifyIdentity(credentials,{...client(false),expectedUserId:FACTOR}),{code:'IDENTITY_MISMATCH'});
 const missing=client(false);missing.client.auth.signInWithPassword=async()=>({data:{user},error:null});await assert.rejects(verifyIdentity(credentials,missing),{code:'AUTH_UNAVAILABLE'});
 const stale=client();stale.client.auth.mfa.challengeAndVerify=async()=>({data:{user},error:null});await assert.rejects(verifyIdentity({...credentials,totpCode:'123456'},stale),{code:'AUTH_UNAVAILABLE'});
});
test('provider and cleanup failures fail closed without exposing errors or credentials',async()=>{
 for(const operation of ['getUser','getAuthenticatorAssuranceLevel','listFactors','challengeAndVerify','signOut']){
  const c=client();const target=operation in c.client.auth?c.client.auth:c.client.auth.mfa;target[operation]=async()=>{throw Error('private-provider-token');};
  await assert.rejects(verifyIdentity({...credentials,totpCode:'123456'},c),e=>e.code==='AUTH_UNAVAILABLE'&&!e.message.includes('private-provider-token'));
 }
});
test('invalid credentials, rate limits, malformed inputs and provider outages have bounded failure responses',async()=>{
 await assert.rejects(verifyIdentity({...credentials,password:'incorrect'},client(false)),{code:'INVALID_CREDENTIALS'});
 for(const [status,code] of [[429,'AUTH_RATE_LIMITED'],[503,'AUTH_UNAVAILABLE']]){const c=client(false);c.client.auth.signInWithPassword=async()=>({data:null,error:{status}});await assert.rejects(verifyIdentity(credentials,c),{code});}
 const c=client();for(const extra of [{password:'x'.repeat(4097)},{totpCode:'12345'},{totpCode:123456},{totpFactorId:'not-a-factor'}])await assert.rejects(verifyIdentity({...credentials,...extra},c),e=>e instanceof IdentityError&&e.status===400);assert.deepEqual(c.events,[]);
});
