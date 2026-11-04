const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../routes/profile');
const valid=()=>({displayName:'My name',bio:'My introduction\nSecond line',timeZone:'Asia/Kolkata',avatarTone:'navy',version:0});
test('self profile fields cannot mutate identity, status or permissions',()=>{
 assert.equal(validate(valid()).displayName,'My name');
 for(const change of [{userId:'other'},{email:'new@fixture.test'},{platformRole:'super_admin'},{status:'active'},{currentHash:'forged'},{avatarTone:'url(https://evil.test)'},{timeZone:'invalid-zone'},{version:-1},{version:1.5},{bio:'x'.repeat(501)},{displayName:'\nowner'},{bio:'\u0000'}])assert.throws(()=>validate({...valid(),...change}));
});
