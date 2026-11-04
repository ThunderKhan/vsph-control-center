// Forward-only canonical upgrades. Generation has no network or database side effects.
const fs = require('node:fs');
const path = require('node:path');
const {verifyManifest} = require('./database');
const {installationEntries,sourceMarker} = require('./history');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
function buildForward(history) {
 const checked=verifyManifest();
 if(checked.errors.length)throw Error('Migration source verification failed');
 const entries=installationEntries(checked.manifest);
 if(!Array.isArray(history)||!history.length||new Set(history.map(h=>h.version)).size!==history.length)
  throw Error('Verified canonical history required');
 for(const row of history){
  const entry=entries.find(e=>e.version===row.version&&e.name===row.name);
  if(!entry||row.source_marker!==sourceMarker(entry))throw Error('Migration history drift');
 }
 if(!history.some(h=>h.version===entries[0].version))throw Error('Baseline reconciliation required');
 const pending=entries.filter(e=>!history.some(h=>h.version===e.version));
 if(!pending.length)throw Error('No pending migrations');
 const expected=history.map(({version,name,source_marker})=>({version,name,source_marker})).sort((a,b)=>a.version.localeCompare(b.version));
 const chunks=[`begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(867530901);
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $vsph_forward$ begin
 if (select jsonb_agg(jsonb_build_object('version',version,'name',name,'source_marker',statements[1]) order by version) from supabase_migrations.schema_migrations)
 is distinct from ${literal(JSON.stringify(expected))}::jsonb then raise exception 'Migration history changed; fresh preflight required';end if;
end $vsph_forward$;`];
 for(const entry of pending){
  const sql=fs.readFileSync(path.resolve(__dirname,'../..',entry.path),'utf8');
  chunks.push(sql);
  chunks.push(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(entry.version)},${literal(entry.name)},array[${literal(sourceMarker(entry))},${literal(sql)}]);`);
 }
 chunks.push("notify pgrst,'reload schema';\ncommit;");
 return {sql:chunks.join('\n\n')+'\n',pending};
}
module.exports={buildForward};
