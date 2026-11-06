const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('new employee onboarding has one secure method, a short action and a private-link handoff',()=>{
 const html=read('views/employee-onboarding.html'),script=read('public/employee-onboarding.js');
 assert.doesNotMatch(html,/name="accessMethod"|employee-access-options|Nothing is saved until you confirm/);
 assert.equal((html.match(/id="employeeConfirmed"/g)||[]).length,1);
 assert.match(html,/I confirm that the employee details provided are correct/);
 assert.match(html,/id="existingEmployeeLink"[^>]+hidden/);
 assert.match(script,/step===2\?'Create employee':'Continue'/);
 assert.match(script,/\/api\/employee-enrollment\/employees\//);
 assert.doesNotMatch(script,/\/api\/employee-credentials\/employees\//);
 assert.match(script,/EMPLOYEE_EXISTS/);
 assert.match(script,/issued\.url/);
});
test('required asterisks remain inline and confirmation checkbox is centered',()=>{
 const html=read('views/employee-onboarding.html'),css=read('public/employees.css');
 assert.equal((html.match(/class="people-field-title"/g)||[]).length,6);
 for(const title of ['Full name','Work email','Department','Job title','Start date','Employment type']){
  assert.ok(html.includes(title+' <em aria-hidden="true">*</em>'),title);
 }
 assert.match(css,/\.people-field-title\{display:inline-flex/);
 assert.match(css,/\.people-confirm\{display:flex;align-items:center/);
 assert.match(css,/\.people-confirm input\[type=checkbox\]\{[^}]+margin:0/);
});

test('both onboarding cards are compact and remove redundant descriptions without sacrificing progress',()=>{
 const html=read('views/employee-onboarding.html'),css=read('public/employees.css');
 assert.match(html,/aria-label="Onboarding progress"/);
 for(const step of ['Identity','Position','Review'])assert.ok(html.includes('<strong>'+step+'</strong>'),step);
 assert.doesNotMatch(html,/people-wizard-note|Only platform owners and explicitly authorized HR managers/);
 assert.doesNotMatch(html,/role="note"|aria-label="Breadcrumb"|Nothing is saved until you confirm/);
 assert.doesNotMatch(html,/Add a real staff roster record|Use the employee's own professional identity/);
 assert.match(css,/\.people-steps\{[^}]+padding:26px 24px/);
 assert.doesNotMatch(css,/\.people-steps\{[^}]*min-height/);
 assert.doesNotMatch(css,/\.people-wizard-panel\{[^}]*min-height/);
});
