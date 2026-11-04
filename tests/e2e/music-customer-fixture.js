// Disposable PostgreSQL fixtures only. No hosted Auth or customer data.
const {hashToken}=require('../../tokens');
module.exports=async pool=>{
 const user='eeaaaaaa-1111-4111-8111-111111111111',org='eeaaaaaa-2222-4222-8222-222222222222';
 await pool.query('insert into auth.users values($1)',[user]);
 await pool.query("insert into profiles(id,full_name,email) values($1,'QA Music customer','music@fixture.test')",[user]);
 await pool.query("insert into organizations(id,name,slug) values($1,'QA Music customer organization','qa-music-only')",[org]);
 await pool.query("insert into organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,user]);
 const app=(await pool.query("select id from applications where code='MUSIC'")).rows[0].id;
 await pool.query('insert into organization_app_access(organization_id,application_id) values($1,$2)',[org,app]);
 await pool.query("insert into subscriptions(organization_id,application_id,status) values($1,$2,'active')",[org,app]);
 await pool.query("insert into user_app_roles(organization_id,user_id,application_id,role_code) values($1,$2,$3,'super_admin')",[org,user,app]);
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",[hashToken('fixture-music-customer-session'),user]);
 await pool.query("insert into music_requests(organization_id,song_title,artist) values($1,'QA Music request','Isolated fixture')",[org]);
};
