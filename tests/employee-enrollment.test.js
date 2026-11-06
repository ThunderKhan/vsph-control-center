const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
const {proof}=require('../routes/employee-enrollment'),{issue,provision}=require('../services/employee-enrollment');
test('employee enrollment proof rejects forged roles, missing consent, weak passwords and malformed capabilities',()=>{
 const b={id:randomUUID(),token:randomBytes(32).toString('base64url')};assert.equal(proof(b).id,b.id);
 for(const extra of [{token:'bad'},{id:'bad'},{purpose:'customer'},{password:'secret'}])assert.throws(()=>proof({...b,...extra}));
 for(const extra of [{password:'short',confirmed:true},{password:'long-password-2026',confirmed:false},{password:'long-password-2026',confirmed:true,hr:true}])assert.throws(()=>proof({...b,...extra},true));
 assert.equal(proof({...b,password:'long-password-2026',confirmed:true},true).confirmed,true);
 assert.equal(proof({...b,password:'eight888',confirmed:true},true).confirmed,true);
 assert.throws(()=>proof({...b,password:'short77',confirmed:true},true));
});
test('provider provisioning refuses an existing unrelated, confirmed or mismatched identity without altering credentials',async()=>{
 const record={id:randomUUID(),authUserId:randomUUID(),email:'staff@fixture.test'};
 for(const user of [{id:randomUUID(),email:record.email},{id:record.authUserId,email:record.email,app_metadata:{}},{id:record.authUserId,email:record.email,app_metadata:{vsph_employee_enrollment:record.id},email_confirmed_at:'2026-11-06'}]){
  let writes=0;await assert.rejects(provision({auth:{admin:{getUserById:async()=>({data:{user},error:null}),createUser:async()=>{writes++;}}}},record),e=>e.enrollmentProvider===true);assert.equal(writes,0);
 }
});
test('lost issuance responses replay without creating identities or returning a replacement capability',async()=>{
 const id=randomUUID();let authCalls=0;
 const client={rpc:async()=>({data:{id,replayed:true},error:null}),auth:{admin:{getUserById:async()=>{authCalls++;}}}};
 const result=await issue({client,actor:randomUUID(),sessionHash:'session',employeeId:randomUUID(),rosterVersion:1,key:randomUUID(),origin:'http://localhost:3000'});
 assert.equal(result.id,id);assert.equal(result.replayed,true);assert.equal(result.url,undefined);assert.equal(authCalls,0);
});
test('invitation origins reject credentials and nonlocal insecure HTTP before any durable or provider call',async()=>{
 for(const origin of ['http://example.test','https://user:password@example.test','javascript:alert(1)']){
  let calls=0;await assert.rejects(issue({client:{rpc:async()=>{calls++;}},origin}));assert.equal(calls,0);
 }
});
