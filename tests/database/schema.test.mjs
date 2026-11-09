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
 const captured=JSON.parse(await readFile('docs/operations/preflight/legacy-catalog-20261101.json','utf8'));
 const actual=(await pool.query(await readFile('services/readiness/legacy-catalog.sql','utf8'))).rows[0].schema_snapshot;
 assert.deepEqual(actual,captured,'Captured hosted core metadata must match the historical baseline used by upgrade tests; no hosted data is imported');
 // Historical order is explicit: filenames originally share a date prefix.
 for(const file of ['20261030_music_sso_launch_codes.sql','20261030_music_staff_musician_roles.sql','20261031000100_atomic_profile_status.sql','20261031000200_durable_provisioning.sql','20261031000300_projects.sql','20261031000400_invitation_disable_revocation.sql','20261031000500_project_delivery.sql','20261031000600_project_notifications.sql','20261031000700_self_service_sessions.sql','20261031065919_overdue_milestone_notifications.sql','20261101052745_member_governance.sql','20261101053314_product_registry.sql','20261101054139_customer_lifecycle.sql','20261103050509_organization_workspace.sql','20261103051256_delegated_organization_invitations.sql','20261103053129_delegated_invitation_profile_locks.sql','20261103062727_organization_owner_transfer.sql','20261103072229_project_work_search.sql','20261103110000_internal_employee_governance.sql','20261103155930_internal_hr_lock_order.sql','20261103165522_internal_employee_identity_links.sql','20261103170000_finance_ledger.sql','20261103171835_finance_exact_snapshot_report.sql','20261104053000_finance_journal.sql','20261104091848_account_profile_preferences.sql','20261104093317_internal_hrms_self_service.sql','20261104153559_owner_dashboard_snapshot.sql','20261106054740_internal_employee_enrollment.sql','20261106063206_internal_employee_temporary_credentials.sql','20261106142000_employee_removal_audit.sql','20261107010000_internal_work_activity.sql','20261107101500_internal_calendar.sql','20261109140000_project_custom_applications.sql','20261109141500_organization_only_onboarding.sql'])
 {if(file==='20261031000500_project_delivery.sql'){
  await pool.query(`insert into auth.users(id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
   insert into profiles(id,full_name,email,status) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Pre-upgrade identity','upgrade@fixture.test','disabled');
   insert into organizations(id,name,slug) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Pre-upgrade tenant','pre-upgrade-tenant');
   insert into organization_memberships(organization_id,user_id,status) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','invited');
   insert into portal_sessions(token_hash,user_id,expires_at) values('pre-upgrade-session','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now()+interval '1 hour');`);
 }
 if(file==='20261101052745_member_governance.sql'){
  // Historical duplicate live invites must fail atomically, preserving rows for reviewed repair.
  const operator='99999999-9999-4999-8999-999999999999',tenant='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await pool.query("insert into auth.users values($1)",[operator]);await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,'Upgrade operator','upgrade-operator@fixture.test','super_admin')",[operator]);
  const jobs=(await pool.query("insert into provisioning_jobs(actor_id,idempotency_key,request,organization_id) select $1,gen_random_uuid(),'{}',$2 from generate_series(1,2) returning id",[operator,tenant])).rows;
  for(const job of jobs){const inv=(await pool.query("insert into membership_invitations(job_id,organization_id,email) values($1,$2,'duplicate-upgrade@fixture.test') returning id",[job.id,tenant])).rows[0];await pool.query('insert into invitation_outbox(invitation_id) values($1)',[inv.id]);}
  const c=await pool.connect();try{await c.query('begin');await assert.rejects(c.query(await readFile('supabase/migrations/'+file,'utf8')),{code:'23505'});}finally{await c.query('rollback');c.release();}
  assert.equal((await pool.query("select count(*) from membership_invitations where email='duplicate-upgrade@fixture.test'")).rows[0].count,'2');
  for(const job of jobs){const inv=(await pool.query('select id from membership_invitations where job_id=$1',[job.id])).rows[0];await pool.query("select provisioning_command($1,'revoke',$2,$3)",[operator,inv.id,{generation:1}]);}
 }
 await pool.query(await readFile('supabase/migrations/'+file,'utf8'));}
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
 // Keep the latest security function installed; populated upgrades are rehearsed separately.
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

test('project ownership, tasks, team, optimistic concurrency, private client scope and history',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./project-cases.js')(pool);});


test('project-owned custom apps preserve isolation, versioning, sharing and audit',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./project-custom-app-cases.js')(pool);});
test('milestone completion validates its proposed dependency',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./project-cases.js').dependencyRegression(pool);});

test('explicit account disable revokes in-flight enrollment even when already staged disabled',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./provisioning-cases.js').disableRegression(pool,app);});

test('delivery grants, private scope, checkpoints, fencing, history, backoff and webhook idempotency',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./delivery-cases.js')(pool);});

test('notification privacy, preferences, duplicate suppression, failure retries and scoped reports',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./notification-cases.js')(pool);});

test('HTTP delivery/report/inbox boundaries deny anonymous, revoked, client, expired and invalid requests',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./delivery-http-cases.js')(pool);});

test('third product uses generic sessions, adapter fallback, entitlement revocation and logout cleanup',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./product-adapter-cases.js')(pool);});

test('self-service session inventory hides hashes, scopes revocation and cascades product sessions',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./session-cases.js')(pool);});

test('populated upgrades preserve tenant, invited/disabled identity, sessions and Phase 4 version defaults',async()=>{
 assert.equal((await pool.query("select status from profiles where email='upgrade@fixture.test'")).rows[0].status,'disabled');
 assert.equal((await pool.query("select status from organization_memberships where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'")).rows[0].status,'invited');
 assert.ok((await pool.query("select public_id from portal_sessions where token_hash='pre-upgrade-session'")).rows[0].public_id);
 assert.equal((await pool.query("select name from organizations where slug='pre-upgrade-tenant'")).rows[0].name,'Pre-upgrade tenant');
});

test('staging inspector validates native catalog security without mutating application data',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./readiness-cases.js')(pool);});

test('overdue milestone reminders are scoped, deduplicated and preference-aware',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./overdue-milestone-cases.js')(pool);});

test('existing organization invitations, renewal, role revocation and concurrent member governance',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./customer-cases.js')(pool,app);});

test('atomic product metadata, lifecycle, visibility, concurrency and secret denial',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./product-registry-cases.js')(pool);});

test('customer lifecycle and entitlement concurrency, audit rollback and suspension/login fencing',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./customer-lifecycle-cases.js')(pool,app);});

test('unmigrated visibility fails closed as schema-not-ready instead of exposing catalog data',async()=>{const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),{hashToken}=require('../../tokens');const admin='44444444-4444-4444-8444-444444444444';await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hashToken('schema-mismatch-admin'),admin]);const server=require('./http-fixture')(pool).listen(0);await new Promise(r=>server.once('listening',r));try{await pool.query('alter table applications rename column visibility to fixture_visibility');const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/apps',{headers:{Cookie:'vsph.portal.sid=schema-mismatch-admin'}});assert.equal(r.status,503);const d=await r.json();assert.equal(d.code,'SCHEMA_NOT_READY');assert.ok(d.requestId);assert.equal(d.applications,undefined);assert.doesNotMatch(JSON.stringify(d),/fixture_visibility|select |token_hash/);}finally{await pool.query('alter table applications rename column fixture_visibility to visibility');await new Promise(r=>server.close(r));}});

test('all thirteen migrations preserve populated legacy records before any feature installation',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./legacy-upgrade-cases.js')(pool,url);});

test('guarded fresh and legacy deployment packages reconcile history and roll back late failures',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./install-cases.js')(pool,url);});
test('forward upgrade preserves populated canonical history, rejects drift, races and rolls back late failures',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./forward-cases.js')(pool,url);});

test('organization self-service scopes customer governance, rejects escalation and serializes stale updates',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./organization-cases.js')(pool,app);});

test('delegated invitations preserve durable delivery, replay protection and current issuer authority',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./delegated-invitation-cases.js')(pool,app);});

test('MFA-aware login refuses incomplete verification before durable session creation',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./identity-cases.js')(pool);});

test('owner transfer uses current session-bound step-up, explicit versions and atomic single-use grants',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./ownership-cases.js')(pool,app);});


test('internal employees are isolated and owner HR assignment cannot escalate customer roles',async()=>{
 const {createRequire}=await import('node:module');
 await createRequire(import.meta.url)('./employee-cases.js')(pool);
});


test('financial ledger enforces owner-only cash accounting, idempotency, and audited corrections',async()=>{
 const {createRequire}=await import('node:module');
 await createRequire(import.meta.url)('./finance-cases.js')(pool);
});

test('project work search paginates current authorized rows and hides private client work',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./search-cases.js')(pool);});

test('HR revocation serializes a blocked workforce mutation without grant/roster deadlock',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./employee-lock-cases.js')(pool);});

test('internal account consent is purpose-bound, current-session verified, concurrent and role-isolated',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./employee-identity-cases.js')(pool);});

test('exact finance snapshot, concurrent receipts and owner authorization',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./finance-report-cases')(pool)});

test('finance journal paginates microsecond cursors, filters current owner scope and preserves history',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./finance-journal-cases')(pool)});

test('personal profiles preserve identity permissions and reject cross-user, expired and concurrent mutations',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./profile-cases')(pool)});

test('internal HRMS enforces own records, owner governance, workflow integrity and concurrency',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./hrms-cases')(pool)});

test('customer-only onboarding creates a durable owner invitation without product entitlements',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./organization-only-cases.js')(pool);});
test('employee calendar is durable, invitee-scoped, concurrent and permission-fenced',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./calendar-cases.js')(pool);});

test('single-statement session reads retain live disable, expiry, role and revoke checks',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./session-performance-cases')(pool)});

test('owner operating snapshots are bounded, coherent, session-scoped and degrade by module',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./owner-snapshot-cases')(pool)});

test('real-account operator setup retries provider failures without overwriting users or mixing roles',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./role-account-cases')(pool)});

test('new employee enrollment preserves Auth ownership, capability isolation, retries and concurrency',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./employee-enrollment-cases')(pool)});

test('temporary HR credentials cannot bypass personal password setup, expiry, revocation and race fencing',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./employee-credentials-cases')(pool)});


test('employee removal archives records, revokes employee links and exposes owner-only audit history',async()=>{
 const {createRequire}=await import('node:module');
 await createRequire(import.meta.url)('./employee-removal-cases.js')(pool);
});

test('supervised notification batch uses durable native queues with duplicate and revoked-access guards',async()=>{const {createRequire}=await import('node:module');await createRequire(import.meta.url)('./worker-cases.js')(pool);});
