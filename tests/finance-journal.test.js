const test=require('node:test'),assert=require('node:assert/strict'),{validate}=require('../routes/finance-journal');
test('journal filters reject forged scope, unbounded paging and rounded or malformed cursor inputs',()=>{
 const cursor={at:'2025-01-01T00:00:00.000018+00:00',id:'11111111-1111-4111-8111-111111111111',scope:'a'.repeat(32)};
 assert.equal(validate({kind:'invoices',search:'  Customer  ',cursor:JSON.stringify(cursor)}).data.cursor.at,cursor.at);
 assert.equal(validate({search:'  Customer  '}).data.search,'Customer');
 assert.equal(validate({search:'😀'}).data.search,'😀');
 assert.throws(()=>validate({search:'bad\ud800'}));
 assert.deepEqual(validate({}),{kind:'invoices',data:{}});
 for(const bad of [{kind:'projects'},{kind:'receipts',status:'issued'},{kind:'invoices',status:'active'},{limit:'5000'},{offset:'25'},{actor:'owner'},{organizationId:'x'},{projectId:'x'},{from:'2025-02-30'},{from:'2026-01-01',to:'2025-01-01'},{search:'x'.repeat(101)},{search:'nul\u0000'},{kind:['invoices']},{cursor:'null'},{cursor:'[]'},{cursor:'{}'},{cursor:'bad json'},...[
  {...cursor,at:'2025-01-01T00:00:00.0000001Z'}, {...cursor,id:'x'}, {...cursor,scope:'x'}, {...cursor,role:'owner'}
 ].map(x=>({cursor:JSON.stringify(x)}))])assert.throws(()=>validate(bad));
});
