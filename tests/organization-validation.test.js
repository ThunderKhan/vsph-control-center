const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../routes/organizations');
const id='11111111-1111-4111-8111-111111111111';
test('organization updates require explicit allowlisted fields and confirmation',()=>{
 const member={userId:id,version:1,role:'member',status:'suspended',confirmed:true};
 assert.equal(validate('member',member),member);
 assert.equal(validate('profile',{version:1,name:'Customer team'}).name,'Customer team');
 for(const [action,data] of [
  ['member',{...member,confirmed:false}],['member',{...member,role:'owner'}],['member',{...member,platformRole:'super_admin'}],['member',{...member,version:0}],
  ['profile',{version:1,name:' '}],['profile',{version:1,name:'Team',slug:'takeover'}],['profile',{version:1,name:'Team\nInjected'}],
  ['role',{userId:id,version:1,applicationId:id,role:'super_admin',confirmed:true}],
 ])assert.throws(()=>validate(action,data));
 assert.equal(validate('role',{userId:id,version:2,applicationId:id,role:'',confirmed:true}).role,'');
});
