'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const {payload,date,meetingLink}=require('../routes/calendar');
const base={title:'Team planning',description:'Weekly sync',
 startAt:'2026-11-18T09:00:00.000Z',endAt:'2026-11-18T10:00:00.000Z',
 category:'meeting',color:'blue',scope:'team',tags:['Work'],attendees:['employee@example.com'],
 meetUrl:'https://meet.google.com/abc-defg-hij'};
test('calendar validates events and normalizes meeting links and invitees',()=>{
 const valid=payload({...base,attendees:['Employee@Example.com','employee@example.com']});
 assert.deepEqual(valid.attendees,['employee@example.com']);
 assert.equal(valid.meetUrl,base.meetUrl);
 assert.equal(date(base.startAt),base.startAt);
 assert.equal(meetingLink(''),'');
 const saved=payload({...base,version:3},true);
 assert.equal(saved.version,3);
 for(const change of [
  {scope:'other'},{category:'invalid'},{color:'rainbow'},{title:' '},
  {startAt:'not a date'},{endAt:'2026-11-18T07:00:00.000Z'},
  {meetUrl:'https://not-google.com/foo'},
  {meetUrl:'https://meet.google.com.evil.test/foo'},
  {tags:Array(9).fill('Work')},
  {attendees:['notanemail']}
 ]) assert.throws(()=>payload({...base,...change}));
 assert.throws(()=>payload({...base,scope:'personal'}));
 assert.throws(()=>payload({...base,version:0},true));
 assert.throws(()=>payload({...base,organizerId:'forged'}));
});
test('employee calendar is mounted only after authorized HRMS access',()=>{
 const dashboard=read('public/dashboard.js');
 const view=read('public/dashboard.html');
 assert.match(dashboard,/accessFlags\?\.employee === true/);
 assert.match(dashboard,/byId\('employeeCalendar'\)\.hidden = false/);
 assert.match(dashboard,/VSPHCalendar\?\.mount/);
 assert.match(view,/id="employeeCalendar"[^>]*hidden/);
 assert.match(view,/calendar\.js/);
 assert.match(view,/calendar\.css/);
 assert.match(view,/calendarNew/);
 assert.match(view,/calendarDialog/);
 assert.doesNotMatch(read('views/my-work.html'),/calendarNew|employeeCalendar/);
});
test('calendar keeps source-inspired views, filters, drag and drop, and reduced motion',()=>{
 const js=read('public/calendar.js'),css=read('public/calendar.css');
 for(const text of ['month','week','day','list','calendarFilterColor','calendarFilterCategory','calendarFilterTag',
  'calendarSearch','calendarPrevious','calendarToday','calendarNext','calendarDialog','dragstart','drop',
  'calendarJoin','request(','attendees','canCompanySchedule'])assert.ok(js.includes(text),text);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/#00255A/);
 assert.match(css,/#0069C8/);
 assert.doesNotMatch(js,/Math\.random|localStorage|demoEvents|sampleEvents|react-dom/i);
 assert.doesNotThrow(()=>new Function(js));
});
test('calendar API uses the session-bound RPC and protects mutating verbs',()=>{
 const route=read('routes/calendar.js');
 const sql=read('supabase/migrations/20261107101500_internal_calendar.sql');
 assert.match(route,/portalSession/);
 assert.match(route,/currentHash:req\.portalSession\.token_hash/);
 assert.match(sql,/perform public\.internal_hrms_guard/);
 assert.match(sql,/organizer_id<>p_actor/);
 assert.match(sql,/internal_calendar_attendees/);
 assert.match(sql,/revoke all on public\.internal_calendar_events,public\.internal_calendar_attendees from public,anon,authenticated/);
 assert.match(sql,/revoke all on function public\.internal_calendar\(uuid,text,uuid,jsonb\) from public,anon,authenticated/);
});
