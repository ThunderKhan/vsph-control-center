const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const {DEPARTMENTS,canonicalDepartment}=require('../services/employee-departments');
const {employeeFields}=require('../routes/employees');

test('employee overview shows KPI labels and counts, without redundant subtitles',()=>{
 const html=read('views/employees.html');
 const metrics=html.match(/<article class="people-metric">[\s\S]*?<\/article>/g)||[];
 assert.equal(metrics.length,5);
 for(const metric of metrics){
  assert.match(metric,/<span>[^<]+<\/span><strong id="staff/);
  assert.doesNotMatch(metric,/<small>/);
 }
 assert.doesNotMatch(html,/Active \+ on leave/);
 assert.match(html,/id="departmentChart"/);
});

test('onboarding and editing offer exactly six approved departments',()=>{
 for(const view of ['views/employee-onboarding.html','views/employees.html']){
  const html=read(view);
  const select=html.match(/<select name="department" required>([\s\S]*?)<\/select>/);
  assert.ok(select,'Department selection missing from '+view);
  const names=[...select[1].matchAll(/<option value="([^"]+)">/g)].map(match=>match[1].replace(/&amp;/g,'&'));
  assert.deepEqual(names,DEPARTMENTS);
  assert.match(select[1],/<option value="" disabled selected>Select a department<\/option>/);
  assert.doesNotMatch(select[1],/Other/);
 }
 assert.match(read('public/employees.js'),/data-legacy-department/);
});

test('API normalizes supported names and rejects arbitrary departments',()=>{
 const sample={fullName:'Example',email:'example@fixture.test',department:'Engineering',jobTitle:'Developer',
  employmentType:'full_time',startDate:'2026-11-06'};
 assert.equal(DEPARTMENTS.length,6);
 for(const department of DEPARTMENTS)assert.equal(employeeFields({...sample,department}).department,department);
 assert.equal(canonicalDepartment('engineering'),'Engineering');
 assert.equal(employeeFields({...sample,department:' engineering '}).department,'Engineering');
 for(const department of ['Other','Development','Software Development','Engineering Team','Unknown']){
  assert.throws(()=>employeeFields({...sample,department}),/approved list/);
  assert.throws(()=>employeeFields({fullName:'Example',department,jobTitle:'Developer',
   employmentType:'full_time',startDate:'2026-11-06',status:'active',version:1,confirmed:true},
   {update:true}),/approved list/);
 }
});
