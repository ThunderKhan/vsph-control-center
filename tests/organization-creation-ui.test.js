const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('organization creation has four accessible steps and separate confirmation and recovery',()=>{
 const html=file('views/onboarding.html'),script=file('public/onboarding.js');
 for(let step=0;step<4;step++)assert.match(html,new RegExp('data-panel="'+step+'"'));
 for(const id of ['orgName','orgSlug','slugStatus','adminName','adminEmail','customOnly',
  'catalogMode','subscriptionCards','reviewDetails','confirm','completeScreen','recoveryScreen',
  'checkOriginalRequest','retryOriginalRequest','completeProject','completeDirectory'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(script,/\/requests\//);assert.match(script,/\/availability\?slug=/);
 assert.match(script,/state\.requestKey/);
 assert.match(html,/Email delivery depends on the configured invitation worker/);
});
test('organization-only default does not silently activate product access',()=>{
 const html=file('views/onboarding.html');
 assert.match(html,/id="customOnly" checked/);
 assert.match(html,/id="catalogConfiguration"[^>]* hidden/);
 assert.match(file('public/onboarding.js'),/no catalog subscription or product grant/i);
});

test('ambiguous requests cannot be edited into a new tenant under an old key',()=>{
 const html=file('views/onboarding.html'),js=file('public/onboarding.js');
 assert.doesNotMatch(html,/id="returnToReview"/);
 assert.match(js,/state\.requestKey/);
 assert.match(js,/retryOriginalRequest/);
});
