const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {once}=require('node:events');
const {requireAdmin}=require('../security');
const self='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const calls=[];
const dbPath=require.resolve('../db'),previous=require.cache[dbPath];
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{
 check:({data,error})=>{if(error)throw error;return data},
 db:()=>({from(table){calls.push(table);return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:{id:other,platform_role:'super_admin'},error:null})}}}})
}};
delete require.cache[require.resolve('../routes/admin-management')];
const router=require('../routes/admin-management');
if(previous)require.cache[dbPath]=previous;else delete require.cache[dbPath];
async function run(role,fn){
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{req.user={id:self,platform_role:role};next()});
 app.use('/api/admin-management',requireAdmin,router);
 const server=app.listen(0,'127.0.0.1');try{await once(server,'listening');await fn('http://127.0.0.1:'+server.address().port)}finally{await new Promise(r=>server.close(r))}
}
test('retired user/client provisioning rejects even admin passwords and elevation without any DB/Auth calls',async()=>{
 calls.length=0;await run('super_admin',async base=>{
  for(const path of ['/users','/clients']){
   const r=await fetch(base+'/api/admin-management'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'never-store-this',platformRole:'super_admin',temporaryPassword:'never-store-this'})});
   assert.equal(r.status,410);assert.equal(r.headers.get('deprecation'),'true');
   assert.doesNotMatch(await r.text(),/never-store-this/);
  }
 });assert.deepEqual(calls,[]);
});
test('regular/customer/product roles cannot reach platform administration',async()=>{
 for(const role of ['user','owner','admin','staff','musician'])await run(role,async base=>{
  const r=await fetch(base+'/api/admin-management/users',{method:'POST'});assert.equal(r.status,403);
 });
});
test('self-disable and another platform admin lifecycle change are denied before mutation',async()=>{
 calls.length=0;await run('super_admin',async base=>{
  for(const [id,status] of [[self,400],[other,409]]){
   const r=await fetch(base+'/api/admin-management/users/'+id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"status":"disabled"}'});
   assert.equal(r.status,status);
  }
 });assert.deepEqual(calls,['profiles']);
});
