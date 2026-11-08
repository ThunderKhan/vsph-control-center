const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('employee dashboard centers the real heatmap and removes explanatory copy',()=>{
 const html=read('public/dashboard.html');
 const css=read('public/employee-bento.css');
 assert.match(html,/id="workActivity"[^>]*data-state="loading"/);
 assert.doesNotMatch(html,/Activity tracks recorded task completions, not working hours or employee performance\./);
 assert.doesNotMatch(html,/Completed tasks recorded over the past 12 months\./);
 assert.match(css,/\.employee-dashboard \.work-activity-card\{margin-inline:auto\}/);
 assert.match(html,/employee-bento\.css/);
 assert.match(html,/work-activity\.js/);
 assert.match(read('public/work-activity.js'),/CELL_SIZE=11,MONTHS=12/);
});

test('employee bento replaces shortcut cards with interactive own-task attendance and leave controls',()=>{
 const html=read('public/dashboard.html');
 for(const name of ['employeeDashboardWork','employeeTasksPanel','employeeAttendancePanel','employeeLeavePanel',
  'employeeTasksMetric','employeeTasksDetail','employeeAttendanceMetric','employeeLeaveMetric',
  'employeeAttendanceSummary','attendanceAction','ownTasks','ownAttendance','leaveForm','ownLeave','moreTasks','firstTasks'])
  assert.match(html,new RegExp('id="'+name+'"'),name);
 assert.doesNotMatch(html,/id="employeeDashboardActions"|class="employee-dashboard-actions"/);
 assert.doesNotMatch(html,/↗/);
 assert.match(html,/name="startOn"/);
 assert.match(html,/name="endOn"/);
 assert.match(html,/name="kind"/);
 assert.match(html,/name="reason"/);
 assert.match(read('views/partials/portal-navigation.html'),/id="myWorkNav" href="\/dashboard#employeeDashboardWork"/);
 assert.match(read('views/my-work.html'),/id="ownTasks"/);
});
test('mounted self-service uses the same session-bound HRMS backend and never fetches for a customer',()=>{
 const js=read('public/hrms.js'),dash=read('public/dashboard.js');
 assert.match(js,/window\.VSPHHRMS=\{/);
 assert.match(js,/mountEmployee\(\)/);
 assert.match(js,/if\(mounted\|\|!\$\('employeeDashboardWork'\)\|\|\$\('employeeDashboardWork'\)\.hidden\)return/);
 assert.match(js,/api\('\/hrms\/me'/);
 assert.match(js,/\/hrms\/me\/tasks\//);
 assert.match(js,/\/hrms\/me\/attendance\//);
 assert.match(js,/\/hrms\/me\/leave/);
 assert.match(js,/employeeTasksMetric/);
 assert.match(js,/employeeAttendanceMetric/);
 assert.match(js,/employeeLeaveMetric/);
 assert.match(dash,/if \(accessFlags\?\.employee === true\)/);
 assert.match(dash,/window\.VSPHHRMS\?\.mountEmployee\(\)/);
 assert.doesNotThrow(()=>new Function(js));
});

test('bento is responsive and removes decorative arrows without breaking functional controls',()=>{
 const css=read('public/employee-bento.css');
 for(const rule of ['@media(max-width:920px)','@media(max-width:640px)','@media(max-width:440px)',
  '@media(prefers-reduced-motion:reduce)','grid-template-columns:repeat(12,minmax(0,1fr))','#00255A','#0069C8'])
  assert.ok(css.includes(rule),rule);
 const html=read('public/dashboard.html');
 assert.doesNotMatch(html,/[↗↖↘↙]/);
 assert.match(html,/id="calendarPrevious"/);
 assert.match(html,/id="calendarNext"/);
});

test('employee accordions expose obvious chevrons, no numeric list markers and accessible native state',()=>{
 const html=read('public/dashboard.html');
 const css=read('public/employee-bento.css');
 assert.match(html,/<details class="employee-work-details">\s*<summary><span>Notifications<\/span><svg[^>]*aria-hidden="true"[^>]*class="employee-details-chevron"|<details class="employee-work-details">\s*<summary><span>Notifications<\/span><svg class="employee-details-chevron" aria-hidden="true"/);
 assert.match(html,/<details class="employee-work-details">\s*<summary><span>Attendance history<\/span>/);
 assert.equal((html.match(/class="employee-details-chevron"/g)||[]).length,2);
 assert.equal((html.match(/class="employee-details-body"/g)||[]).length,2);
 assert.match(html,/<div id="ownNotifications" class="employee-record-list">/);
 assert.match(html,/<div id="ownAttendance" class="employee-record-list">/);
 assert.match(css,/\.employee-work-details summary\{[^\n]*display:flex[^\n]*min-height:48px/);
 assert.match(css,/\.employee-work-details summary::-webkit-details-marker\{display:none\}/);
 assert.match(css,/\.employee-work-details summary::marker\{content:""\}/);
 assert.match(css,/\.employee-work-details\[open\] \.employee-details-chevron\{transform:rotate\(180deg\)\}/);
 assert.match(css,/@supports selector\(details::details-content\)/);
 assert.match(css, /content-visibility 240ms allow-discrete/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/\.employee-work-details summary\{[^\n]*list-style:auto/);
});
