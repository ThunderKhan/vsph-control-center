const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {isConfigured,submit,senderConfig}=require('../services/employee-invitation-email');
const {invitationMode}=require('../routes/employee-enrollment');
test('employee invitation email is opt-in and unsafe provider configuration fails closed',()=>{
 assert.equal(invitationMode({}),'manual');assert.equal(invitationMode({delivery:'email'}),'email');
 for(const delivery of ['other',true,null])assert.throws(()=>invitationMode({delivery}));
 assert.equal(isConfigured({}),false);
 for(const url of ['http://mail.example.test','https://user:pass@mail.example.test','javascript:alert(1)','https://mail.example.test/#fragment'])
  assert.equal(isConfigured({EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL:url,NODE_ENV:'production'}),false);
 assert.equal(isConfigured({EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL:'https://mail.example.test/send',NODE_ENV:'production'}),true);
 assert.equal(senderConfig({EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL:'http://127.0.0.1:3100/send',NODE_ENV:'development'}).url,'http://127.0.0.1:3100/send');
});
test('employee invitation webhook submits its private link and never claims delivery',async()=>{
 const env={EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL:'https://mail.example.test/send',EMPLOYEE_INVITATION_EMAIL_WEBHOOK_TOKEN:'server-only-token',NODE_ENV:'production'};
 const inviteUrl='https://control.example.test/employee-enrollment#enrollment_id='+randomUUID()+'&token=capability';
 let calls=0;
 assert.equal(await submit({to:'member@example.test',inviteUrl},{env,fetchImpl:async(url,opts)=>{
  calls++;assert.equal(url,env.EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL);
  assert.equal(opts.headers.Authorization,'Bearer server-only-token');assert.equal(opts.redirect,'error');
  const payload=JSON.parse(opts.body);assert.equal(payload.to,'member@example.test');assert.equal(payload.type,'employee_invitation');assert.ok(payload.text.includes(inviteUrl));
  return {ok:true,status:202};
 }}),true);assert.equal(calls,1);
 assert.equal(await submit({to:'member@example.test',inviteUrl},{env,fetchImpl:async()=>({ok:false,status:503})}),false);
 assert.equal(await submit({to:'member@example.test',inviteUrl},{env,fetchImpl:async()=>{throw Error('private provider credentials');}}),false);
 assert.equal(await submit({to:'not-an-address',inviteUrl},{env,fetchImpl:async()=>{calls++;}}),false);
 assert.equal(await submit({to:'member@example.test',inviteUrl},{env:{},fetchImpl:async()=>{calls++;}}),false);assert.equal(calls,1);
});
