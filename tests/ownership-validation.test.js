const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../routes/ownership');
const intent={targetUserId:'11111111-1111-4111-8111-111111111111',organizationVersion:1,ownerVersion:2,targetVersion:3};
test('ownership payloads bind explicit reviewed versions and reject client authentication assertions',()=>{
 assert.deepEqual(validate({...intent,password:'private'},true),intent);assert.deepEqual(validate({...intent,confirmed:true}),intent);
 for(const data of [{...intent,confirmed:false},{...intent,confirmed:true,assurance:'aal2'},{...intent,confirmed:true,proofHash:'forged'},{...intent,confirmed:true,ownerVersion:0},{...intent,confirmed:true,actorId:intent.targetUserId}])assert.throws(()=>validate(data));
 for(const extra of [{verifiedAt:new Date().toISOString()},{currentHash:'forged'},{assurance:'aal2'}])assert.throws(()=>validate({...intent,password:'private',...extra},true));
});
