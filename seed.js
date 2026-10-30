require('dotenv').config();
const {db,check,configured}=require('./db');
const DEMO_PASSWORD=process.env.DEMO_PASSWORD;
async function ensureUser(name,email,role){
 let profile=check(await db().from('profiles').select('id').eq('email',email).maybeSingle());
 if(profile){check(await db().from('profiles').update({full_name:name,platform_role:role,status:'active'}).eq('id',profile.id));return profile.id}
 const {data,error}=await db().auth.admin.createUser({email,password:DEMO_PASSWORD,email_confirm:true});
 if(error)throw error;
 check(await db().from('profiles').insert({id:data.user.id,email,full_name:name,platform_role:role,status:'active'}));
 return data.user.id;
}
async function main(){
 if(!configured())throw new Error('Copy .env.example to .env and set Supabase keys first.');
 if(!DEMO_PASSWORD||DEMO_PASSWORD.length<12)throw new Error('Set DEMO_PASSWORD in .env to a unique value at least 12 characters long.');
 const apps=check(await db().from('applications').select('id,code'));
 if(!apps.some(a=>a.code==='CRM')||!apps.some(a=>a.code==='MUSIC'))throw new Error('Run supabase/schema.sql in the Supabase SQL Editor first.');
 const appMap=Object.fromEntries(apps.map(a=>[a.code,a.id]));
 const users={};
 for(const [key,name,email,role] of [
  ['owner','VSPH Platform Owner','owner@vsph.test','super_admin'],
  ['crm','CRM Alpha Owner','crm@vsph.test','user'],
  ['beta','CRM Beta Owner','beta@vsph.test','user'],
  ['music','Music Venue Owner','music@vsph.test','user'],
  ['both','Multi Product Owner','both@vsph.test','user']]){
    users[key]=await ensureUser(name,email,role);
 }
 const specs=[
  {slug:'vsph-internal',name:'VSPH Internal',apps:['CRM','MUSIC'],members:['owner']},
  {slug:'alpha-crm',name:'Alpha CRM Ltd',apps:['CRM'],members:['crm']},
  {slug:'beta-crm',name:'Beta CRM Ltd',apps:['CRM'],members:['beta']},
  {slug:'music-venue',name:'Music Venue Ltd',apps:['MUSIC'],members:['music']},
  {slug:'both-products',name:'Both Products Ltd',apps:['CRM','MUSIC'],members:['both']}
 ];
 for(const spec of specs){
  const org=check(await db().from('organizations').upsert({slug:spec.slug,name:spec.name,status:'active'},{onConflict:'slug'}).select('id').single());
  for(const key of spec.members)check(await db().from('organization_memberships').upsert({organization_id:org.id,user_id:users[key],role:'owner',status:'active'},{onConflict:'organization_id,user_id'}));
  for(const code of spec.apps){
   const application_id=appMap[code];
   check(await db().from('subscriptions').upsert({organization_id:org.id,application_id,plan_code:'demo',status:'active',ends_at:null},{onConflict:'organization_id,application_id'}));
   check(await db().from('organization_app_access').upsert({organization_id:org.id,application_id,status:'enabled'},{onConflict:'organization_id,application_id'}));
   for(const key of spec.members)check(await db().from('user_app_roles').upsert({organization_id:org.id,application_id,user_id:users[key],role_code:key==='both'&&code==='CRM'?'user':'super_admin'},{onConflict:'organization_id,user_id,application_id'}));
  }
  if(spec.apps.includes('CRM')){
   const existing=check(await db().from('crm_contacts').select('id').eq('organization_id',org.id).limit(1));
   if(!existing.length)check(await db().from('crm_contacts').insert({organization_id:org.id,name:`${spec.name} Demo Contact`,email:`contact@${spec.slug}.test`,company:spec.name}));
  }
  if(spec.apps.includes('MUSIC')){
   const existing=check(await db().from('music_requests').select('id').eq('organization_id',org.id).limit(1));
   if(!existing.length)check(await db().from('music_requests').insert({organization_id:org.id,song_title:`${spec.name} Demo Song`,artist:'Sample Artist'}));
  }
 }
 console.log('Demo seeded. Accounts: owner@vsph.test, crm@vsph.test, beta@vsph.test, music@vsph.test, both@vsph.test');
 console.log('All demo accounts use the DEMO_PASSWORD value from .env; existing users retain their previous password.');
}
main().catch(err=>{console.error('Seed failed:',err.message);process.exitCode=1});
