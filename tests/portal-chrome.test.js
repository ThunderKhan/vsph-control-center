const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

const authenticatedPages=[
 'views/employee-onboarding.html','views/employees.html','views/employee-identity.html',
 'views/onboarding.html','views/customers.html','views/products.html',
 'views/provisioning.html','views/account-profile.html','views/organizations.html',
 'views/hr-access.html','views/hr-workspace.html','views/my-work.html',
 'views/search.html','views/finance.html','views/finance-journal.html',
 'views/sso-launch.html','public/admin.html','public/app-home.html'
];
test('authenticated pages use the shared top navigation, without duplicate breadcrumbs or back-to-dashboard controls',()=>{
 const injected=read('services/portal-page.js');
 for(const file of authenticatedPages){
  const html=read(file);
  assert.doesNotMatch(html,/aria-label="Breadcrumb"|class="people-nav"|class="finance-nav"/,file);
  assert.doesNotMatch(html,/>Back to (?:employees|overview|administration|applications|Control Center)</,file);
 }
 for(const file of ['views/customerx.html'.replace('customerx','customers'),'views/products.html','views/provisioning.html']){
  assert.doesNotMatch(read(file),/<main class="project-page"><nav>/,file);
 }
 assert.match(injected,/workspaceHeader\(user,escape,navigation\)/);
 assert.match(injected,/portal-navigation\.css/);
 // Anonymous password and invitation journeys deliberately have independent back links.
 assert.match(read('views/accept-invite.html'),/Back to sign in/);
 assert.match(read('views/auth.html'),/id="backLink"/);
});
test('repetitive introductory labels and cards disappear, but operational safety notices remain',()=>{
 for(const file of ['views/employee-onboarding.html','views/employees.html','views/onboarding.html','views/employee-identity.html']){
  const html=read(file);
  assert.doesNotMatch(html,/PEOPLE \/ INTERNAL|PEOPLE \/ IDENTITY|CUSTOMER SUCCESS \/ SETUP|class="people-info"|class="people-wizard-note"/,file);
 }
 for(const file of ['views/customers.html','views/products.html','views/provisioning.html','views/hr-access.html','views/hr-workspace.html','views/my-work.html','views/account-profile.html','views/organizations.html','views/search.html','views/finance.html','views/finance-journal.html']){
  const html=read(file);
  assert.doesNotMatch(html,/<header[^>]*>(?:<div>)?<p class="(?:eyebrow|finance-eyebrow)">/,file);
 }
 assert.doesNotMatch(read('public/admin.html'),/class="admin-purpose"|Back to overview/);
 assert.match(read('views/finance.html'),/Manual cash ledger — INR only/);
 assert.match(read('views/finance-journal.html'),/Read-only history/);
 assert.match(read('views/employees.html'),/id="employeeEditForm"/);
 assert.match(read('views/employee-onboarding.html'),/id="employeeOnboardForm"|id="onboardError"/);
});
test('step panels and sidebar are intrinsically sized without old fixed minimum heights',()=>{
 const html=read('views/employee-onboarding.html'),css=read('public/employees.css');
 for(const title of ['Identity','Position','Review'])assert.ok(html.includes('<strong>'+title+'</strong>'));
 assert.equal((html.match(/data-staff-panel=/g)||[]).length,3);
 assert.doesNotMatch(css,/\.people-steps\{[^}]+min-height/);
 assert.doesNotMatch(css,/\.people-wizard-panel\{[^}]+min-height/);
 assert.match(css,/\.people-wizard\{[^}]+align-items:start/);
 assert.match(css,/\.people-wizard-panel\{padding:30px\}/);
});
