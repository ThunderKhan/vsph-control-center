const test=require('node:test'),assert=require('node:assert/strict');
const {searchQuery}=require('../routes/search');
test('search accepts only literal bounded queries and typed narrowing filters',()=>{
 assert.deepEqual(searchQuery({q:'  50%_  ',kind:'task',status:'blocked',from:'2026-02-28'}),{projectId:null,data:{q:'50%_',kind:'task',status:'blocked',from:'2026-02-28'}});
 for(const q of [{},{q:'x'},{q:'x'.repeat(101)},{q:'ab\ncd'},{q:['ab','cd']},{q:'ab',actor:'forged'},{q:'ab',limit:'10000'},{q:'ab',kind:'comments'},{q:'ab',status:'deleted'},{q:'ab',projectId:'bad'},{q:'ab',assigneeId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},{q:'ab',from:'2026-02-30'},{q:'ab',from:'2026-02-02',to:'2026-02-01'},{q:'ab',after:'4:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},{q:'ab',after:'1:'+ '-'.repeat(36)}])assert.throws(()=>searchQuery(q),e=>e.validation===true);
});
