// Synthetic, disposable PostgreSQL only. Never reads SUPABASE_* configuration.
const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const {randomUUID, createHash} = require('node:crypto');
const {performance} = require('node:perf_hooks');
const pg = require('pg');
const identifier = value => {
  assert.match(value, /^[a-z_]+$/);
  return '"' + value + '"';
};
async function snapshot(db, columns) {
  const result = {};
  for (const [key, names] of Object.entries(columns)) {
    const [schema, table] = key.split('.');
    result[key] = (await db.query('select coalesce(jsonb_agg(v order by v::text),\'[]\'::jsonb) records from (select to_jsonb(t) v from (select ' + names.map(identifier).join(',') + ' from ' + identifier(schema) + '.' + identifier(table) + ') t) d')).rows[0].records;
  }
  return result;
}
module.exports = async function legacyUpgrade(base, inputUrl) {
  const url = new URL(inputUrl);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname) && url.pathname === '/vsph_test', 'Only the disposable loopback fixture database is allowed');
  // Never overwrite/reset a database. A pre-existing rehearsal target is an error.
  await base.query('create database vsph_upgrade_rehearsal');
  url.pathname = '/vsph_upgrade_rehearsal';
  const db = new pg.Pool({connectionString:url.toString(),max:1});
  try {
    await db.query("create schema auth; create table auth.users(id uuid primary key,email text not null,encrypted_password text not null,raw_app_meta_data jsonb not null); create schema extensions; create extension pgcrypto with schema extensions;");
    await db.query(await readFile('supabase/schema.sql','utf8'));
    await db.query("update applications set name='Preserved custom '||code,login_path=case code when 'CRM' then '/apps/crm/login' else '/apps/music/login' end");
    const apps=(await db.query('select id,code from applications order by code')).rows;
    const people=Array.from({length:6},()=>randomUUID()),tenants=Array.from({length:6},()=>randomUUID());
    for(let i=0;i<6;i++) {
      await db.query('insert into auth.users values($1,$2,$3,$4)',[people[i],`person-${i}@fixture.test`,'SYNTHETIC-NOT-A-REAL-PASSWORD-HASH',{provider:'fixture',fixture:i}]);
      await db.query('insert into profiles(id,full_name,email,status,platform_role) values($1,$2,$3,$4,$5)',[people[i],`Synthetic ${i}`,`person-${i}@fixture.test`,i===5?'disabled':'active',i===0?'super_admin':'user']);
      await db.query('insert into organizations(id,name,slug,status) values($1,$2,$3,$4)',[tenants[i],`Synthetic tenant ${i}`,`legacy-${i}`,i===4?'suspended':i===5?'closed':'active']);
      await db.query('insert into organization_memberships(organization_id,user_id,role,status) values($1,$2,$3,$4)',[tenants[i],people[i],['owner','admin','member','viewer','member','member'][i],i===2?'invited':i===4?'suspended':'active']);
      for (const a of apps.filter(a=>a.code==='CRM'||i<2)) {
        await db.query("insert into subscriptions(organization_id,application_id,plan_code,status,starts_at,ends_at) values($1,$2,$3,$4,'2020-01-01T00:00:00Z',$5)",[tenants[i],a.id,'preserved-terms-'+i,['active','trial','past_due','cancelled','expired','active'][i],i===4?'2021-01-01T00:00:00Z':'2030-01-01T00:00:00Z']);
        await db.query('insert into organization_app_access(organization_id,application_id,status) values($1,$2,$3)',[tenants[i],a.id,i===4?'suspended':i===5?'revoked':'enabled']);
        await db.query('insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,$4)',[tenants[i],people[i],a.id,i===0?'manager':i===3?'viewer':'user']);
      }
      await db.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",['fixture-portal-'+i,people[i],i===3?'2020-01-01T00:00:00Z':'2030-01-01T00:00:00Z']);
    }
    for(let i=0;i<2;i++)await db.query("insert into app_sessions(token_hash,portal_token_hash,user_id,organization_id,application_id,expires_at) values($1,$2,$3,$4,$5,'2030-01-01T00:00:00Z')",['fixture-app-'+i,'fixture-portal-'+i,people[i],tenants[i],apps[i].id]);
    for(let i=0;i<4;i++)await db.query('insert into crm_contacts(organization_id,name,email,company,created_by) values($1,$2,$3,$4,$5)',[tenants[i],`Contact ${i}`,`contact-${i}@fixture.test`,'Synthetic only',people[i]]);
    for(let i=0;i<3;i++)await db.query('insert into music_requests(organization_id,song_title,artist,status,created_by) values($1,$2,$3,$4,$5)',[tenants[0],`Synthetic song ${i}`,'Fixture artist',['submitted','queued','played'][i],people[0]]);
    await db.query("insert into audit_logs(actor_user_id,organization_id,action,details) values($1,$2,'fixture.baseline',$3)",[people[0],tenants[0],{preserve:true}]);
    const columns={};
    for(const row of (await db.query("select table_schema,table_name,column_name from information_schema.columns where table_schema='public' or (table_schema='auth' and table_name='users') order by table_schema,table_name,ordinal_position")).rows) {
      (columns[row.table_schema+'.'+row.table_name]??=[]).push(row.column_name);
    }
    const before=await snapshot(db,columns);
    const manifest=JSON.parse(await readFile('supabase/migration-manifest.json','utf8')),timings=[];
    for(const migration of manifest.migrations) {
      const sql=await readFile(migration.path,'utf8');
      assert.equal(createHash('sha256').update(sql).digest('hex'),migration.sha256,'Never rehearse drifted SQL');
      const started=performance.now();
      await db.query('begin');
      try {
        await db.query("set local lock_timeout='2s';set local statement_timeout='15s'");
        await db.query(sql);
        await db.query('commit');
      } catch(error) {
        await db.query('rollback');
        throw error;
      }
      const after=await snapshot(db,columns);
      for(const [table, records] of Object.entries(before)) {
        const actual=table==='public.app_roles'?after[table].filter(r=>!['staff','musician'].includes(r.code)):after[table];
        assert.deepEqual(actual,records,`${migration.path} must preserve every original column and row in ${table}`);
      }
      timings.push({migration:migration.name,milliseconds:Math.round(performance.now()-started)});
    }
    assert.equal((await db.query("select count(*) from app_roles r join applications a on a.id=r.application_id where r.code in ('staff','musician') and a.code='MUSIC'")).rows[0].count,'2');
    for(const table of ['organizations','organization_memberships','applications'])assert.equal((await db.query('select count(*) from '+identifier(table)+' where version<>1')).rows[0].count,'0');
    assert.equal((await db.query("select count(*) from applications where visibility<>'listed' or integration_mode<>'adapter'")).rows[0].count,'0');
    assert.equal((await db.query('select count(distinct public_id) from portal_sessions')).rows[0].count,'6');
    assert.equal((await db.query('select count(*) from membership_invitations')).rows[0].count,'0','Never synthesize an invitation for legacy invited memberships');
    assert.equal((await db.query("select count(*) from organization_memberships where status='invited'")).rows[0].count,'1');
    // Pool.query discards a connection after a rejected query: pin SET ROLE and
    // both denial assertions to one checked-out client, preserving the boundary.
    const denied=await db.connect();
    try {
      for(const role of ['anon','authenticated']) {
        await denied.query('set role '+role);
        try {
          await assert.rejects(denied.query('select * from public.crm_contacts'),{code:'42501'});
          await assert.rejects(denied.query("select public.customer_command($1,'list',null,'{}')",[people[0]]),{code:'42501'});
        }finally{await denied.query('reset role');}
      }
    }finally{denied.release();}
    console.log(JSON.stringify({scope:'synthetic-populated-legacy-upgrade',migrations:timings.length,preservedTables:Object.keys(before).length,hostedVerified:false,hostedDowntimeMeasured:false,timings}));
  }finally{await db.end();}
};
