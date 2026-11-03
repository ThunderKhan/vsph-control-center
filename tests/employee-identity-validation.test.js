const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../routes/employee-identity');
test('employee identity actions bind documented versions and reject forged verification/roles',()=>{
 assert.deepEqual(validate('request',{rosterVersion:2,confirmed:true}),{rosterVersion:2,confirmed:true});
 const data={rosterVersion:2,requestVersion:1,confirmed:true,password:'fixture-only'};assert.equal(validate('accept',data).requestVersion,1);
 for(const bad of [{...data,verifiedAt:new Date().toISOString()},{...data,assurance:'aal2'},{...data,currentHash:'forged'},{...data,actor:'forged'},{...data,role:'super_admin'},{...data,rosterVersion:2147483648},{...data,requestVersion:1.1},{...data,password:[]},{...data,confirmed:false},{...data,totpCode:'123'},{...data,totpFactorId:'bad'}])assert.throws(()=>validate('accept',bad),e=>e.validation===true);
 for(const action of ['renew','cancel','revoke'])assert.throws(()=>validate(action,{rosterVersion:1,confirmed:true}));
});
