const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('employee work page mounts activity under the employee summary, not on the profile form',()=>{
 const html=read('views/my-work.html');
 assert.match(html,/id="employeeName"/);
 assert.match(html,/id="workActivity"/);
 assert.ok(html.indexOf('id="employeeDetails"')<html.indexOf('id="workActivity"'));
 assert.ok(html.indexOf('id="workActivity"')<html.indexOf('id="ownTasks"'));
 assert.match(html,/work-activity\.js/);
 assert.match(html,/work-activity\.css/);
 assert.doesNotMatch(read('views/account-profile.html'),/workActivity/);
});

test('activity reproduces supplied sizing and timing without importing React',()=>{
 const source=read('public/work-activity.js'),css=read('public/work-activity.css');
 assert.match(source,/CELL_SIZE=11,MONTHS=12,STACK_LIMIT=3,MIN_CARD_WIDTH=320/);
 assert.match(source,/COLUMN_STAGGER=12/);
 assert.match(source,/ResizeObserver/);
 assert.match(source,/work-activity-tooltip/);
 assert.match(css,/620ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/200ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/450ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/140ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(source,/github-contributions-api|api\.github\.com|Math\.random|react|motion\/react/i);
});

test('activity API is session-scoped, self-only and refuses client query filters',()=>{
 const route=read('routes/hrms.js');
 assert.match(route,/router\.use\(portalSession/);
 assert.match(route,/router\.get\('\/me\/activity'/);
 assert.match(route,/Object\.keys\(req\.query\)\.length/);
 assert.match(route,/p_actor:req\.user\.id,p_session_hash:req\.portalSession\.token_hash/);
 const sql=read('supabase/migrations/20261107010000_internal_work_activity.sql');
 assert.match(sql,/perform public\.internal_hrms_guard\(p_actor,p_session_hash\)/);
 assert.match(sql,/a\.actor_user_id=p_actor/);
 assert.match(sql,/t\.assignee_id=p_actor/);
 assert.match(sql,/m\.user_id=p_actor and m\.status='active'/);
 assert.match(sql,/a\.details->>'to'='done'/);
 assert.match(sql,/revoke all on function public\.internal_work_activity\(uuid,text\) from public,anon,authenticated/);
 assert.doesNotMatch(sql,/insert into public\.project_tasks|update public\.project_tasks|truncate /i);
});
