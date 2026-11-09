const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('employee directory has one role-governed Manage menu, full-width departments and no redundant panels',()=>{
 const view=read('views/employees.html'),ui=read('public/employees.js'),css=read('public/employees.css');
 assert.match(view,/<th scope="col">Manage<\/th>/);
 assert.doesNotMatch(view,/Your permissions|hrGovernance|removedEmployeeHistory/);
 assert.match(view,/id="departmentChart"/);
 assert.match(css,/\.people-overview\{display:block/);
 assert.match(ui,/openManage\(trigger,employee,role\)/);
 assert.match(ui,/role==='owner'&&employee\.is_hr/);
 assert.match(ui,/if\(!employee\.is_owner\)/);
 assert.match(ui,/aria-haspopup/);
 assert.match(ui,/Escape/);
 assert.match(ui,/VSPHUI\.confirm/);
});
test('owner-only audit and HR access governance moved into administration',()=>{
 const admin=read('public/admin.html'),controller=read('public/admin.js'),nav=read('views/partials/portal-navigation.html');
 assert.match(admin,/data-tab="permissions"/);
 assert.match(admin,/data-audit-view="removals"/);
 assert.match(admin,/id="auditRemovalGrid"/);
 assert.match(controller,/api\/employees\/removals/);
 assert.match(controller,/loadWorkforceRoles/);
 assert.match(controller,/VSPHUI\.details/);
 assert.match(nav,/href="\/admin\?tab=permissions"/);
 assert.doesNotMatch(read('views/employees.html'),/id="hrManagers"/);
 const sql=read('supabase/migrations/20261106142000_employee_removal_audit.sql');
 assert.match(sql,/authority->>'role'<>'owner'/);
});
test('shared modern dialogs and toasts load on all authenticated portal pages',()=>{
 const shell=read('services/portal-page.js'),ui=read('public/feedback-ui.js'),css=read('public/feedback-ui.css');
 assert.match(shell,/feedback-ui\.js/);assert.match(shell,/feedback-ui\.css/);
 assert.match(ui,/showModal/);assert.match(ui,/aria-modal/);assert.match(ui,/toast/);
 assert.match(css,/vsph-ui-dialog::backdrop/);assert.match(css,/vsph-toast-region/);
 for(const p of ['public/employees.js','public/admin.js','public/finance.js','public/employee-identity.js','public/organizations.js','public/customers.js','public/products.js','public/account-sessions.js','public/projects.js','public/project-delivery.js','public/hrms.js']){
  const js=read(p);assert.doesNotMatch(js,/\bwindow\.(?:confirm|prompt|alert)\s*\(/,p);
 }
});
test('account menu has connected rounded open state and owner permissions remain backend-controlled',()=>{
 const header=read('services/workspace-header.js'),nav=read('public/portal-navigation.css');
 assert.match(header,/portal-account-chevron/);
 assert.match(nav,/\.crm-header-actions \.portal-account\[open\]>summary/);
 assert.match(nav,/border-radius:999px/);
 assert.match(read('public/portal-navigation.js'),/\/api\/hrms\/access/);
});
