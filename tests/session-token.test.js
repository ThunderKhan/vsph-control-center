const test=require('node:test');const assert=require('node:assert/strict');
const {newToken,hashToken,appCookie}=require('../tokens');
test('opaque session token differs every time and hashes consistently',()=>{
 const first=newToken(),second=newToken();assert.notEqual(first,second);assert.notEqual(hashToken(first),hashToken(second));assert.equal(hashToken(first),hashToken(first));assert.equal(hashToken(first).length,64)
});
test('application sessions have separate cookie names',()=>{assert.notEqual(appCookie('CRM'),appCookie('MUSIC'));assert.equal(appCookie('CRM'),'vsph.crm.sid')});
