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
 for(const file of ['20261030_music_sso_launch_codes.sql','20261030_music_staff_musician_roles.sql','20261031000100_atomic_profile_status.sql','20261031000200_durable_provisioning.sql'])
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
  await assert.rejects(c.query("select set_profile_status($1,$1,'disabled')",[user]),{code:'42501'});
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

test('real database-backed Express tenant and session authorization matrix',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const {hashToken,appCookie}=require('../../tokens');
 const {once}=await import('node:events');
 const otherOrg='33333333-3333-4333-8333-333333333333';
 await pool.query("insert into organizations(id,name,slug) values ($1,'Other Synthetic','other-synthetic')",[otherOrg]);
 for(const tenant of [org,otherOrg]){
  await pool.query("insert into subscriptions(organization_id,application_id,status) values ($1,$2,'active')",[tenant,app]);
  await pool.query('insert into organization_app_access(organization_id,application_id) values ($1,$2)',[tenant,app]);
  await pool.query("insert into music_requests(organization_id,song_title) values ($1,$2)",[tenant,tenant===org?'Own tenant song':'Foreign tenant secret']);
 }
 await pool.query('insert into organization_memberships(organization_id,user_id) values ($1,$2)',[org,user]);
 await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values ($1,$2,$3,'staff')",[org,user,app]);
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values ($1,$2,now()+interval '1 hour')",[hashToken('http-portal'),user]);
 await pool.query("insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values ($1,$2,$3,$4,$5,now()+interval '1 hour')",[hashToken('http-app'),hashToken('http-portal'),user,org,app]);
 const application=require('./http-fixture.js')(pool);const server=application.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const headers={Cookie:'vsph.portal.sid=http-portal; '+appCookie('MUSIC')+'=http-app'};
 const get=path=>fetch(base+path,{headers,redirect:'manual'});
 try{
  assert.equal((await fetch(base+'/api/apps/MUSIC/records')).status,401);
  let r=await get('/api/apps/MUSIC/records?organizationId='+otherOrg);assert.equal(r.status,200);
  assert.deepEqual((await r.json()).records.map(x=>x.song_title),['Own tenant song']);
  r=await get('/api/apps/MUSIC/contexts');assert.deepEqual((await r.json()).organizations.map(x=>x.id),[org]);
  // A platform admin sees registry/admin controls but cannot become arbitrary customer staff.
  await pool.query("update profiles set platform_role='super_admin' where id=$1",[user]);
  r=await get('/api/apps/MUSIC/contexts');assert.deepEqual((await r.json()).organizations.map(x=>[x.id,x.role]),[[org,'staff']]);
  await pool.query('delete from user_app_roles where user_id=$1',[user]);
  assert.equal((await get('/api/apps/MUSIC/records')).status,403);
  await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values ($1,$2,$3,'musician')",[org,user,app]);
  await pool.query("update profiles set platform_role='user' where id=$1",[user]);
  // Product-specific role denies writes while maintaining authorized reads.
  for(const role of ['viewer','musician']){
   await pool.query('update user_app_roles set role_code=$1 where user_id=$2',[role,user]);
   assert.equal((await get('/api/apps/MUSIC/records')).status,200);
   const write=await fetch(base+'/api/apps/MUSIC/records',{method:'POST',headers:{...headers,'Origin':process.env.PUBLIC_ORIGIN||'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({song_title:'Must not be inserted',organization_id:otherOrg})});
   assert.equal(write.status,403);
  }
  assert.equal((await pool.query("select * from music_requests where song_title='Must not be inserted'")).rowCount,0);

  for(const status of ['invited','suspended']){
   await pool.query('update organization_memberships set status=$1 where user_id=$2',[status,user]);
   assert.equal((await get('/api/apps/MUSIC/records')).status,403,status);
  }
  await pool.query("update organization_memberships set status='active' where user_id=$1",[user]);
  await pool.query("update subscriptions set ends_at=now()-interval '1 second' where organization_id=$1",[org]);
  assert.equal((await get('/api/apps/MUSIC/records')).status,403);
  await pool.query('update subscriptions set ends_at=null where organization_id=$1',[org]);
  await pool.query("update profiles set status='disabled' where id=$1",[user]);
  assert.equal((await get('/api/apps/MUSIC/records')).status,401);
  await pool.query("update profiles set status='active' where id=$1",[user]);
  await pool.query('delete from portal_sessions where user_id=$1',[user]);
  assert.equal((await get('/api/apps/MUSIC/records')).status,401);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('atomic account disable revokes sessions/codes, audits once and cannot revive on enable',async()=>{
 const actor='44444444-4444-4444-8444-444444444444';
 await pool.query('insert into auth.users values ($1)',[actor]);
 await pool.query("insert into profiles(id,full_name,email,platform_role) values ($1,'Synthetic Admin','admin-fixture@example.test','super_admin')",[actor]);
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values ('lifecycle-portal',$1,now()+interval '1 hour')",[user]);
 await pool.query("insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values ('lifecycle-app','lifecycle-portal',$1,$2,$3,now()+interval '1 hour')",[user,org,app]);
 await pool.query(`insert into sso_launch_codes(code_hash,client_id,application_id,user_id,portal_token_hash,organization_id,code_challenge,expires_at)
 values ($1,'music-vercel',$2,$3,'lifecycle-portal',$4,$5,now()+interval '1 minute')`,['d'.repeat(64),app,user,org,'e'.repeat(43)]);
 const countBefore=Number((await pool.query("select count(*) from audit_logs where action='user.status_changed'")).rows[0].count);
 const changes=await Promise.all([1,2].map(()=>pool.query("select set_profile_status($1,$2,'disabled')",[actor,user])));
 assert.equal(changes.length,2);
 assert.equal((await pool.query('select status from profiles where id=$1',[user])).rows[0].status,'disabled');
 for(const table of ['portal_sessions','app_sessions','sso_launch_codes'])assert.equal((await pool.query('select * from '+table+' where user_id=$1',[user])).rowCount,0);
 assert.equal(Number((await pool.query("select count(*) from audit_logs where action='user.status_changed'")).rows[0].count),countBefore+1);
 await pool.query("select set_profile_status($1,$2,'active')",[actor,user]);
 assert.equal((await pool.query('select * from portal_sessions where user_id=$1',[user])).rowCount,0);
 await assert.rejects(pool.query("select set_profile_status($1,$2,'disabled')",[actor,actor]),{code:'22023'});
 await assert.rejects(pool.query("select set_profile_status($1,$2,'disabled')",[user,actor]),{code:'42501'});
 // Installing the forward function again must preserve populated rows.
 await pool.query(await readFile('supabase/migrations/20261031000100_atomic_profile_status.sql','utf8'));
 assert.equal((await pool.query('select status from profiles where id=$1',[user])).rows[0].status,'active');
});
test('audit failure rolls back account status and revocation together',async()=>{
 const actor='44444444-4444-4444-8444-444444444444';
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values ('rollback-portal',$1,now()+interval '1 hour')",[user]);
 await pool.query(`create function public.fixture_reject_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit outage'; end$$;
 create trigger fixture_reject_audit before insert on public.audit_logs for each row execute function public.fixture_reject_audit();`);
 try{
  await assert.rejects(pool.query("select set_profile_status($1,$2,'disabled')",[actor,user]),{code:'P0001'});
  assert.equal((await pool.query('select status from profiles where id=$1',[user])).rows[0].status,'active');
  assert.equal((await pool.query("select * from portal_sessions where token_hash='rollback-portal'")).rowCount,1);
 }finally{await pool.query('drop trigger fixture_reject_audit on public.audit_logs; drop function public.fixture_reject_audit()')}
});

test('durable provisioning, leases, retries, invitation purpose and membership-isolated concurrent acceptance',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 await require('./provisioning-cases.js')(pool,app);
});
