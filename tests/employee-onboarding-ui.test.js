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

test('polish adds labeled step progress, correct section headings, and explicit submission feedback',()=>{
 const html=read('views/employee-onboarding.html');
 const script=read('public/employee-onboarding.js');
 const css=read('public/employees.css');
 assert.match(html,/id="staffProgressBar"[^>]+role="progressbar"[^>]+aria-valuenow="33"/);
 for(const index of [0,1,2])assert.ok(html.includes('id="wizardTitle-'+index+'" tabindex="-1"'));
 assert.match(html,/data-staff-step="0" class="current" aria-current="step"/);
 assert.match(html,/id="onboardComplete"[^>]+tabindex="-1"/);
 assert.match(script,/setAttribute\('aria-valuenow',String\(progress\)\)/);
 assert.match(script,/setAttribute\('aria-current','step'\)/);
 assert.match(script,/legends\[step\]\.focus\(\)/);
 assert.match(script,/textContent='Creating…'/);
 assert.match(script,/removeAttribute\('aria-busy'\)/);
 assert.match(script,/setAttribute\('aria-invalid','true'\)/);
 assert.match(css,/\.people-wizard-step label\{font-size:14px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('redesign isolates the wizard from a compact completion state and preserves one-time secrets',()=>{
 const html=read('views/employee-onboarding.html'),js=read('public/employee-onboarding.js'),css=read('public/employees.css');
 for(const id of ['onboardingWizard','employeeReviewIdentity','employeeReviewPosition','onboardComplete',
  'onboardRecovery','checkEmployeeStatus','employeeHandoffValue','copyEmployeeHandoff','setupEmployeeLogin']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(html,/id="employeeHandoffValue"[^>]*readonly/);
 assert.match(html,/class="people-review-edit" data-edit-step="0"/);
 assert.match(html,/class="people-review-edit" data-edit-step="1"/);
 assert.match(html,/id="onboardComplete"[^>]*hidden/);
 assert.match(js,/function finishEdit\(apply\)/);
 assert.match(js,/textContent='Discard changes'/);
 assert.match(js,/step===2\?'Create employee':'Continue'/);
 assert.match(js,/window\.addEventListener\('beforeunload'/);
 assert.match(js,/window\.addEventListener\('pagehide',clearInvitation\)/);
 assert.match(js,/linkAvailable&&!linkCopied/);
 assert.match(js,/function unknownResult\(data\)/);
 assert.match(js,/async function checkExisting\(email\)/);
 assert.match(js,/Idempotency-Key/);
 assert.doesNotMatch(js,/localStorage|sessionStorage/);
 assert.match(css,/\.people-completion-shell\{max-width:680px/);
 assert.match(css,/@media\(max-width:1024px\)/);
 assert.match(css,/@media\(max-width:640px\)/);
});
