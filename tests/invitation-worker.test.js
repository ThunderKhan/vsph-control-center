const test=require('node:test'),assert=require('node:assert/strict');
const {crypt,dispatchOne}=require('../services/invitation-worker');
test('outbox ciphertext is authenticated, encrypted and key-bound',()=>{const k='a'.repeat(64),s=crypt('secret invitation',k);assert.ok(!s.includes('secret'));assert.equal(crypt(s,k,true),'secret invitation');assert.throws(()=>crypt(s,'b'.repeat(64),true));assert.throws(()=>crypt('x','short'));});
test('delivery cannot run without an explicit adapter and key',async()=>{await assert.rejects(dispatchOne({}),/adapter/);await assert.rejects(dispatchOne({deliver:async()=>{},origin:'https://example.test'}),/KEY/)});
test('external failure schedules durable retry and never claims sent',async()=>{
 const calls=[];const client={rpc:async(name,a)=>{calls.push(a.p_action);if(a.p_action==='claim')return {data:{outbox:{id:'outbox',encrypted_delivery:crypt(JSON.stringify({url:'https://example.test/#secret'}),'a'.repeat(64))},invitation:{id:'invite',generation:1},job:{}},error:null};return {data:{ok:true},error:null}}};
 await assert.rejects(dispatchOne({client,key:'a'.repeat(64),origin:'https://example.test',deliver:async()=>{throw Error('mail failed with confidential details')}}),/reconciliation/);
 assert.deepEqual(calls,['claim','failed']);
});
