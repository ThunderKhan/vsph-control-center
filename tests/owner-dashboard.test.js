const test=require('node:test'),assert=require('node:assert/strict');
const {ownerDashboard}=require('../services/owner-dashboard');
function client(failed){
 const reads=[];
 return {reads,from(table){const entry={table};reads.push(entry);const q={select(fields,options){entry.fields=fields;entry.options=options;return q;},eq(key,value){entry.filter=[key,value];return q;},order(){return q;},limit(n){entry.limit=n;return q;},then(resolve,reject){return Promise.resolve(table===failed?{error:{message:'private provider details'}}:entry.options?.head?{count:3}:{data:[{id:'11111111-1111-4111-8111-111111111111',name:'Real project',status:'active',kind:'internal',created_at:'x',private:'secret'}]}).then(resolve,reject);}};return q;}};
}
test('owner dashboard uses exact aggregate counts and bounded project allowlists',async()=>{
 const db=client(),result=await ownerDashboard(db);
 assert.equal(result.customers.active,3);assert.equal(result.workforce.total,3);
 assert.deepEqual(Object.keys(result.delivery.recent[0]).sort(),['id','kind','name','status']);
 assert.equal(db.reads.find(r=>r.limit).limit,6);
 assert.ok(db.reads.filter(r=>!r.limit).every(r=>r.options.count==='exact'&&r.options.head));
});
test('a missing module never invents zero counts or hides other operating sections',async()=>{
 const result=await ownerDashboard(client('project_tasks'));
 assert.deepEqual(result.delivery,{status:'unavailable'});
 assert.equal(result.customers.status,'ready');assert.equal(result.workforce.status,'ready');
 assert.doesNotMatch(JSON.stringify(result),/private provider details|secret/);
});
