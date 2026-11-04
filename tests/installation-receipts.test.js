const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {installationEntries,sourceMarker,separateReceipts}=require('../services/readiness/history');
const {verifyManifest}=require('../services/readiness/database');
test('operator receipt recognition preserves unknown history and verifies exact SQL plus canonical dependencies',()=>{
 const manifest=verifyManifest().manifest,entries=installationEntries(manifest);
 const canonical=entries.map(e=>({version:e.version,name:e.name,source_marker:sourceMarker(e)}));
 const sql='reviewed fixture package',receipt={version:'20261104070249',name:'vsph_canonical_forward_repair_20261104',source_marker:sql};
 const known={version:receipt.version,name:receipt.name,sqlSha256:crypto.createHash('sha256').update(sql).digest('hex'),requires:[entries.at(-1).version]};
 const all=[...canonical,receipt];
 assert.equal(separateReceipts(all,manifest,[known]).history.length,canonical.length);
 assert.equal(all.length,canonical.length+1,'No hosted or input history is deleted');
 for(const change of [{source_marker:'changed'},{version:'unknown'},{name:'unknown'}])
  assert.equal(separateReceipts([...canonical,{...receipt,...change}],manifest,[known]).receipts.length,0);
 assert.equal(separateReceipts([...canonical.slice(0,-1),receipt],manifest,[known]).receipts.length,0);
 assert.equal(separateReceipts([...canonical.slice(0,-1),{...canonical.at(-1),source_marker:'changed'},receipt],manifest,[known]).receipts.length,0);
 assert.equal(separateReceipts(all,manifest).receipts.length,0,'Fixture package cannot impersonate registered hosted receipt');
});
