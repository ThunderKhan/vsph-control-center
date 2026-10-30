import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
const url=new URL(process.env.TEST_DATABASE_URL||'http://missing.invalid');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.pathname==='/vsph_test',
 'TEST_DATABASE_URL must point to an EMPTY loopback database named vsph_test');
const pool=new pg.Pool({connectionString:url.toString(),max:4});
const user='11111111-1111-4111-8111-111111111111';
const org='22222222-2222-4222-8222-222222222222';
let app;
test.before(async()=>{
 const existing=await pool.query("select tablename from pg_tables where schemaname='public'");
 assert.equal(existing.rowCount,0,'Refusing bootstrap against a populated database');
 await pool.query(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);`);
 await pool.query(await readFile('supabase/schema.sql','utf8'));
 // Historical order is explicit: filenames originally share a date prefix.
 for(const file of ['20261030_music_sso_launch_codes.sql','20261030_music_staff_musician_roles.sql'])
  await pool.query(await readFile('supabase/migrations/'+file,'utf8'));
 await pool.query('insert into auth.users values ($1)',[user]);
 await pool.query("insert into profiles(id,full_name,email) values ($1,'Synthetic User','fixture@example.test')",[user]);
 await pool.query("insert into organizations(id,name,slug) values ($1,'Synthetic Venue','synthetic-venue')",[org]);
 app=(await pool.query("select id from applications where code='MUSIC'")).rows[0].id;
});
test.after(()=>pool.end());
test('all application tables enable RLS',async()=>{
 const r=await pool.query("select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity");
 assert.deepEqual(r.rows,[]);
});
test('browser roles cannot read tenant data or execute privileged RPC',async()=>{
 for(const role of ['anon','authenticated']){
 const c=await pool.connect();try{
  await c.query('set role '+role);
  await assert.rejects(c.query('select * from public.organizations'),{code:'42501'});
  await assert.rejects(c.query("select * from consume_sso_launch_code('x')"),{code:'42501'});
 }finally{await c.query('reset role');c.release()}
 }
});
test('role assignment requires matching membership and product grant',async()=>{
 await assert.rejects(pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values ($1,$2,$3,'staff')",[org,user,app]),{code:'23503'});
});
test('Music roles exist only for Music',async()=>{
 const r=await pool.query("select a.code from app_roles r join applications a on a.id=r.application_id where r.code in ('staff','musician')");
 assert.equal(r.rowCount,2);assert.ok(r.rows.every(x=>x.code==='MUSIC'));
});
test('unique tenant slug rejects concurrent duplicates',async()=>{
 const results=await Promise.allSettled([1,2].map(()=>pool.query("insert into organizations(name,slug) values ('Synthetic','race-tenant')")));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'23505');
});
test('launch code consumption is atomic across concurrent connections',async()=>{
 await pool.query(`insert into sso_launch_codes(code_hash,client_id,application_id,user_id,portal_token_hash,organization_id,code_challenge,expires_at)
 values ($1,'music-vercel',$2,$3,'portal-fixture',$4,$5,now()+interval '1 minute')`,['a'.repeat(64),app,user,org,'b'.repeat(43)]);
 const results=await Promise.all([1,2].map(()=>pool.query('select * from consume_sso_launch_code($1)',['a'.repeat(64)])));
 assert.equal(results.reduce((n,r)=>n+r.rowCount,0),1);
});
test('portal logout cascades application session deletion',async()=>{
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values ('test-portal',$1,now()+interval '1 hour')",[user]);
 await pool.query("insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values ('test-app','test-portal',$1,$2,$3,now()+interval '1 hour')",[user,org,app]);
 await pool.query("delete from portal_sessions where token_hash='test-portal'");
 assert.equal((await pool.query("select * from app_sessions where token_hash='test-app'")).rowCount,0);
});
