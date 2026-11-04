const test=require('node:test'),assert=require('node:assert/strict');
const {buildForward,historyGuard}=require('../services/readiness/forward');
const {verifyManifest}=require('../services/readiness/database');
const {installationEntries,sourceMarker}=require('../services/readiness/history');
test('forward upgrade detects lower-version gaps and never replays the baseline or installed migrations',()=>{
 const entries=installationEntries(verifyManifest().manifest);
 const pendingNames=['project_work_search','internal_hr_lock_order','internal_employee_identity_links','finance_ledger','finance_exact_snapshot_report','finance_journal'];
 const history=entries.filter(e=>!pendingNames.includes(e.name)).map(e=>({version:e.version,name:e.name,source_marker:sourceMarker(e)}));
 const pack=buildForward(history);
 assert.deepEqual(pack.pending.map(e=>e.name),pendingNames);
 assert.match(pack.sql,/lock table supabase_migrations.schema_migrations/);
 assert.match(pack.sql,/Migration history changed/);
 assert.match(pack.sql,/^begin;/);assert.match(pack.sql,/commit;\n$/);
 assert.doesNotMatch(pack.sql,/create table public.profiles|on conflict\(code\) do update/);
 assert.throws(()=>buildForward([]));
 assert.throws(()=>buildForward([...history,history[0]]));
 assert.throws(()=>buildForward(history.map((h,i)=>i? h:{...h,source_marker:'changed'})));
 assert.throws(()=>buildForward(history.slice(1)));
 assert.throws(()=>buildForward([...history,{version:'unknown',name:'unknown',source_marker:'x'}]));
 assert.throws(()=>buildForward(entries.map(e=>({version:e.version,name:e.name,source_marker:sourceMarker(e)}))));
});

test('history guards hash receipt SQL instead of nesting executable delimiters',()=>{
 const source="do $vsph_forward$ begin raise notice 'nested'; end $vsph_forward$; -- $$";
 const sql=historyGuard([{version:'20990101000000',name:'synthetic_receipt',source_marker:source}]);
 assert.ok(sql.includes(require('node:crypto').createHash('sha256').update(source).digest('hex')));
 assert.ok(!sql.includes(source));assert.match(sql,/pg_catalog.sha256/);assert.equal((sql.match(/\$vsph_forward\$/g)||[]).length,2);
});
