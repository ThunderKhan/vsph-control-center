const {hashToken}=require('../../tokens');
module.exports=async pool=>{
 const owner='dddddddd-1111-4111-8111-111111111111';
 await pool.query('insert into auth.users values($1)',[owner]);
 await pool.query("insert into profiles(id,full_name,email) values($1,'Customer Owner','customer-owner@fixture.test')",[owner]);
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",[hashToken('fixture-customer-owner-session'),owner]);
 for(const [i,label] of [[1,'desktop'],[2,'mobile']]){
  const org='ffffffff-1111-4111-8111-11111111111'+i,member='dddddddd-2222-4222-8222-22222222222'+i;
  await pool.query('insert into organizations(id,name,slug) values($1,$2,$3)',[org,'Customer '+label,'self-service-'+label]);
  await pool.query('insert into auth.users values($1)',[member]);await pool.query('insert into profiles(id,full_name,email) values($1,$2,$3)',[member,'Team '+label,'team-'+label+'@fixture.test']);
  await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')",[org,owner,member]);
  const app=(await pool.query("select id from applications where code='CRM'")).rows[0].id;
  await pool.query('insert into organization_app_access(organization_id,application_id) values($1,$2)',[org,app]);await pool.query("insert into subscriptions(organization_id,application_id,status) values($1,$2,'active')",[org,app]);await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,'admin')",[org,owner,app]);
 }
 for(const [i,label] of [[1,'desktop'],[2,'mobile']]){
  const org='abababab-4444-4444-8444-44444444444'+i,target='abababab-5555-4555-8555-55555555555'+i;
  await pool.query('insert into organizations(id,name,slug) values($1,$2,$3)',[org,'Ownership '+label,'ownership-'+label]);await pool.query('insert into auth.users values($1)',[target]);await pool.query('insert into profiles(id,full_name,email) values($1,$2,$3)',[target,'Successor '+label,'successor-'+label+'@fixture.test']);await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin')",[org,owner,target]);
 }
};
