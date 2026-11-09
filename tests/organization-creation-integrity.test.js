const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('organization creation cannot use ownerless legacy insertion',()=>{
 const source=read('routes/admin-management.js');
 assert.match(source,/router\.post\('\/organizations',\(req,res\)=>/);
 assert.match(source,/res\.status\(410\)/);
 assert.doesNotMatch(source,/from\('organizations'\)\.insert\(\{name,slug\}\)/);
});
test('onboarding exposes explicit slug preview and request recovery to the owner',()=>{
 const source=read('routes/onboarding.js');
 assert.match(source,/router\.get\('\/availability'/);
 assert.match(source,/router\.get\('\/requests\/:key'/);
 assert.match(source,/\.eq\('actor_id',req\.user\.id\)/);
});