const test=require('node:test'),assert=require('node:assert/strict');
const {reviewHrAccess}=require('../services/employee-hr-readiness');
const req={user:{id:'owner'},params:{id:'employee'},portalSession:{token_hash:'server-session'}};
function fixture({role='owner',status='active',account=true,linked=false,pending=false,failure=false,granted=false}={}){
 const calls=[];const review={employee:{email:'employee@example.test',status},link:linked?{status:'linked'}:null,requests:pending?[{state:'pending'}]:[]};
 const database={rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_action==='access'?{role}:review,error:null};},from:table=>{calls.push({table});const chain={select:()=>chain,eq:()=>chain,limit:async()=>({data:table==='internal_hr_managers'?(granted?[{employee_id:'employee'}]:[]):account?[{id:'ordinary'}]:[],error:failure?Error('Provider unavailable'):null})};return chain;}};
 return {database,calls,review};
}
test('HR readiness denies HR and ordinary users before reading a roster or profile',async()=>{
 for(const role of ['hr','user',null]){const f=fixture({role});await assert.rejects(reviewHrAccess(f.database,req),{code:'42501'});assert.equal(f.calls.length,1);}
});
test('HR readiness explains enrollment, activation and consent without granting authority',async()=>{
 for(const [options,state,canGrant,canRequest] of [[{granted:true,linked:true},'already_hr',false,false],[{account:false},'account_required',false,false],[{status:'inactive'},'inactive_employee',false,false],[{},'consent_required',false,true],[{pending:true},'consent_pending',false,false],[{linked:true},'ready',true,false],[{linked:true,account:false},'account_required',false,false]]){
  const f=fixture(options),result=await reviewHrAccess(f.database,req);assert.equal(result.state,state);assert.equal(result.canGrant,canGrant);assert.equal(result.canRequest,canRequest);assert.ok(result.message.length>20);
  assert.ok(f.calls.every(c=>!['grant_hr','request','accept'].includes(c.args?.p_action)));
 }
});
test('profile provider failures fail closed; no ready state is invented',async()=>{
 const f=fixture({linked:true,failure:true});await assert.rejects(reviewHrAccess(f.database,req),/Provider unavailable/);
});
