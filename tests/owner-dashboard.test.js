const test=require('node:test'),assert=require('node:assert/strict'),{ownerDashboard}=require('../services/owner-dashboard');
test('operating read model makes one session-bound RPC, never twenty REST count requests',async()=>{
 let calls=0;const expected={customers:{status:'ready',active:3}};const client={from(){assert.fail('Per-table REST reads must not return');},async rpc(name,args){calls++;assert.equal(name,'owner_dashboard_snapshot');assert.deepEqual(args,{p_actor:'owner',p_action:'get',p_id:null,p_data:{currentHash:'opaque-hash'}});return {data:expected,error:null};}};
 assert.equal(await ownerDashboard(client,'owner','opaque-hash'),expected);assert.equal(calls,1);
});
test('operating-model failures never become fabricated zero metrics or unauthorized requests',async()=>{
 let calls=0;const client={async rpc(){calls++;return {data:null,error:{code:'42501',message:'Denied'}};}};await assert.rejects(ownerDashboard(client,null,'hash'),{code:'42501'});assert.equal(calls,0);await assert.rejects(ownerDashboard(client,'owner','hash'),{code:'42501'});assert.equal(calls,1);
});
