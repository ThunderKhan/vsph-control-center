const assert=require('node:assert/strict'),pg=require('pg'),fs=require('node:fs');
const {buildForward,historyGuard}=require('../../services/readiness/forward');
const {verifyManifest,inspectDatabase,assess}=require('../../services/readiness/database');
const {installationEntries,sourceMarker}=require('../../services/readiness/history');
module.exports=async(base,inputUrl)=>{
 const url=new URL(inputUrl);
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.pathname==='/vsph_test');
 await base.query('create database vsph_forward');url.pathname='/vsph_forward';
 const a=new pg.Client({connectionString:url.toString()}),b=new pg.Client({connectionString:url.toString()});
 await a.connect();await b.connect();
 try{
  await a.query('create schema auth;create table auth.users(id uuid primary key);create schema extensions;create extension pgcrypto with schema extensions;create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
  const entries=installationEntries(verifyManifest().manifest),missing=new Set(['project_work_search','internal_hr_lock_order','internal_employee_identity_links','finance_ledger','finance_exact_snapshot_report','finance_journal','internal_hrms_self_service']);
  const installed=entries.filter(e=>!missing.has(e.name)),history=installed.map(e=>({version:e.version,name:e.name,source_marker:sourceMarker(e)}));
  for(const e of installed){await a.query(fs.readFileSync(e.path,'utf8'));await a.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[e.version,e.name,[sourceMarker(e)]]);}
  await a.query("insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');insert into profiles(id,email,full_name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','preserved@fixture.test','Preserved');insert into organizations(name,slug) values('Preserved customer','preserved-customer');update applications set name='Custom '||code;");
  const before=(await a.query('select row_to_json(p) row from profiles p order by id')).rows;
  const receipt={version:'20990101000000',name:'synthetic_receipt',source_marker:"do $vsph_forward$ begin raise notice 'nested';end $vsph_forward$; -- $$"};
  await a.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[receipt.version,receipt.name,[receipt.source_marker]]);
  const guard=historyGuard([...history,receipt]);await a.query(guard);
  await a.query('update supabase_migrations.schema_migrations set statements=array[$1] where version=$2',[receipt.source_marker+'-- drift',receipt.version]);await assert.rejects(a.query(guard),/history changed/);
  await a.query('update supabase_migrations.schema_migrations set statements=array[$1] where version=$2',[receipt.source_marker,receipt.version]);await a.query(guard);
  assert.throws(()=>buildForward([...history,receipt]),/history drift/,'Hashing never bypasses receipt classification');await a.query('delete from supabase_migrations.schema_migrations where version=$1',[receipt.version]);
  const pack=buildForward(history);
  await assert.rejects(a.query(pack.sql.replace("notify pgrst,'reload schema';",'select 1/0;')),{code:'22012'});await a.query('rollback');
  assert.equal((await a.query("select to_regclass('public.finance_invoices') t")).rows[0].t,null);
  assert.equal((await a.query('select count(*) from supabase_migrations.schema_migrations')).rows[0].count,String(installed.length));
  await a.query("update supabase_migrations.schema_migrations set name='drift' where version='20261030000000'");
  await assert.rejects(a.query(pack.sql),/history changed/);await a.query('rollback');
  await a.query("update supabase_migrations.schema_migrations set name='vsph_verified_baseline' where version='20261030000000'");
  const results=await Promise.allSettled([a.query(pack.sql),b.query(pack.sql)]);
  await a.query('rollback');await b.query('rollback');assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/history changed/);
  assert.deepEqual((await a.query('select row_to_json(p) row from profiles p order by id')).rows,before);
  assert.equal((await a.query("select count(*) from organizations where slug='preserved-customer'")).rows[0].count,'1');
  assert.ok((await a.query('select name from applications')).rows.every(r=>r.name.startsWith('Custom ')));
  const ready=assess(await inspectDatabase(a),verifyManifest().manifest);assert.deepEqual(ready.blockers,[]);
  await assert.rejects(a.query(pack.sql),/history changed/);await a.query('rollback');
 }finally{await a.end();await b.end();}
};
