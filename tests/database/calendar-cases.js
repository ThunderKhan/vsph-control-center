'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const [owner,staff,invitee,hr,customer]=Array.from({length:5},()=>randomUUID());
 const all=[owner,staff,invitee,hr,customer];
 const email=u=>u+'@calendar.test';
 const employees=new Map();
 for(const u of all){
  await pool.query('insert into auth.users(id) values($1)',[u]);
  await pool.query("insert into profiles(id,full_name,email,platform_role) values($1,$2,$3,$4)",
   [u,'Calendar '+u,email(u),u===owner?'super_admin':'user']);
  await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '3 hours')",
   ['cal-'+u,u]);
 }
 for(const u of [staff,invitee,hr]){
  const r=(await pool.query("select internal_employee_command($1,'create',$2,$3) d",
   [owner,randomUUID(),{fullName:'Calendar '+u,email:email(u),department:'Engineering',
    jobTitle:'Engineer',employmentType:'full_time',startDate:'2026-11-01'}])).rows[0].d;
  employees.set(u,r.id);
  await pool.query("update internal_employees set status='active' where id=$1",[r.id]);
  await require('./employee-link-fixture')(pool,owner,u,r.id);
 }
 const hrVersion=(await pool.query('select version from internal_employees where id=$1',[employees.get(hr)])).rows[0].version;
 await pool.query("select internal_employee_identity($1,'grant_hr',$2,$3)",[owner,employees.get(hr),
  {rosterVersion:hrVersion,confirmed:true,currentHash:'cal-'+owner}]);
 const call=async(u,action,id=null,fields={},hash='cal-'+u)=>
  (await pool.query('select internal_calendar($1,$2,$3,$4) d',[u,action,id,{...fields,currentHash:hash}])).rows[0].d;
 const fields={title:'Sprint planning',description:'Agenda and blockers',
  startAt:'2026-11-18T09:00:00.000Z',endAt:'2026-11-18T10:00:00.000Z',
  color:'blue',category:'meeting',scope:'personal',tags:['work'],attendees:[],meetUrl:''};
 const range={from:'2026-11-01T00:00:00.000Z',to:'2026-12-01T00:00:00.000Z'};
 await assert.rejects(call(customer,'list',null,range),{code:'42501'});
 await assert.rejects(call(staff,'list',null,range,'cal-'+invitee),{code:'42501'});
 await assert.rejects(call(staff,'list',null,{from:range.from,to:'2028-01-01T00:00:00Z'}),{code:'22023'});
 const id=randomUUID();assert.equal((await call(staff,'create',id,fields)).saved,true);
 await assert.rejects(call(staff,'create',id,fields),{code:'23505'});
 assert.equal((await call(staff,'list',null,range)).events.length,1);
 assert.equal((await call(invitee,'list',null,range)).events.length,0);
 assert.equal((await call(owner,'list',null,range)).events.length,0);
 await assert.rejects(call(staff,'create',randomUUID(),{...fields,scope:'company'}),{code:'42501'});
 await assert.rejects(call(staff,'create',randomUUID(),{...fields,scope:'personal',attendees:[email(invitee)]}),{code:'22023'});
 await assert.rejects(call(staff,'create',randomUUID(),{...fields,scope:'team',attendees:[email(customer)]}),{code:'22023'});
 await assert.rejects(call(staff,'create',randomUUID(),{...fields,meetUrl:'https://evil.test/meet'}),{code:'22023'});
 const meetingId=randomUUID();
 await call(staff,'create',meetingId,{...fields,scope:'team',attendees:[email(invitee)],
  meetUrl:'https://meet.google.com/abc-defg-hij'});
 const invited=(await call(invitee,'list',null,range)).events;
 assert.equal(invited.length,1);assert.equal(invited[0].canEdit,false);
 assert.equal(invited[0].meetUrl,'https://meet.google.com/abc-defg-hij');
 await assert.rejects(call(invitee,'save',meetingId,{...fields,scope:'team',attendees:[],version:1}),{code:'42501'});
 const race=await Promise.allSettled([call(staff,'save',meetingId,{...fields,scope:'team',
  attendees:[email(invitee)],version:1,title:'Moved A',startAt:'2026-11-19T09:00:00Z',
  endAt:'2026-11-19T10:00:00Z'}),call(staff,'save',meetingId,{...fields,scope:'team',
  attendees:[email(invitee)],version:1,title:'Moved B'})]);
 assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(race.find(x=>x.status==='rejected').reason.code,'40001');
 await assert.rejects(call(invitee,'delete',meetingId,{version:2}),{code:'42501'});
 assert.equal((await call(hr,'list',null,range)).canCompanySchedule,true);
 const companyId=randomUUID();
 await call(hr,'create',companyId,{...fields,scope:'company',title:'All-hands',
  attendees:[email(staff),email(invitee)]});
 assert.ok((await call(staff,'list',null,range)).events.some(x=>x.title==='All-hands'&&!x.canEdit));
 await call(hr,'delete',companyId,{version:1});
 assert.ok(!(await call(staff,'list',null,range)).events.some(x=>x.title==='All-hands'));
 await call(staff,'delete',meetingId,{version:2});
 assert.equal((await call(invitee,'list',null,range)).events.length,0);
 const browser=await pool.connect();
 try{
  for(const role of ['anon','authenticated']){
   await browser.query('set role '+role);
   for(const table of ['internal_calendar_events','internal_calendar_attendees'])
    await assert.rejects(browser.query('select * from '+table),{code:'42501'});
   await assert.rejects(browser.query("select internal_calendar($1,'list',null,$2)",[staff,{currentHash:'cal-'+staff,...range}]),{code:'42501'});
   await browser.query('reset role');
  }
 }finally{await browser.query('reset role');browser.release();}
 await pool.query("update internal_employee_identity_links set status='revoked',revoked_at=now(),version=version+1 where user_id=$1",[staff]);
 await assert.rejects(call(staff,'list',null,range),{code:'42501'});
 assert.equal((await pool.query("select count(*)::int n from audit_logs where target_type='calendar_event' and action='calendar.create' and actor_user_id=$1",[staff])).rows[0].n,2);
};
