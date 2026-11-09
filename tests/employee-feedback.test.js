const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('employee enrollment has equal-width actions, visibility controls and eight-character minimum',()=>{
 const view=read('views/employee-enrollment.html'),script=read('public/employee-enrollment.js'),
  css=read('public/invite.css'),route=read('routes/employee-enrollment.js');
 assert.equal((view.match(/minlength="8"/g)||[]).length,2);
 assert.equal((view.match(/data-password-target=/g)||[]).length,2);
 assert.match(view,/id="enrollmentStrengthFill"/);
 assert.match(script,/function estimate\(value\)/);
 assert.match(script,/aria-pressed/);
 assert.match(css,/\.employee-enrollment-page \.invite-return\{display:flex;width:100%;min-height:48px/);
 assert.match(route,/body\.password\.length<8/);
});
test('the shared avatar menu contains a real sign-out action and no separate logout icon',()=>{
 const css=read('public/portal-navigation.css');
 const {workspaceHeader}=require('../services/workspace-header');
 const html=workspaceHeader({full_name:'Example User',status:'active',platform_role:'user'},value=>String(value));
 const menu=html.split('class="portal-dropdown"')[1]||'';
 assert.ok(menu,'The account dropdown must exist');
 const profile=menu.indexOf('href="/account/profile"');
 const security=menu.indexOf('href="/account/security"');
 const signout=menu.indexOf('id="logoutButton"');
 assert.ok(profile>=0&&security>profile&&signout>security,
   'Profile, Security, and Sign out must appear in the account dropdown');
 assert.equal((html.match(/id="logoutButton"/g)||[]).length,1);
 assert.doesNotMatch(html,/<button id="logoutButton" class="crm-header-icon"/);
 assert.match(css,/\.portal-account \.portal-signout/);
});
test('the account dashboard prioritizes employee status and links to the existing roster editor',()=>{
 const js=read('public/employee-identity.js');
 assert.match(js,/identity-dashboard-hero/);
 assert.match(js,/identity-status-grid/);
 assert.match(js,/Manage employment status/);
 assert.match(js,/&edit=/);
 assert.match(js,/identity-technical/);
});
test('removal requires confirmation and exposes audit history only through a dedicated owner action',()=>{
 const route=read('routes/employees.js'),ui=read('public/employees.js'),view=read('views/employees.html');
 const sql=read('supabase/migrations/20261106142000_employee_removal_audit.sql');
 assert.match(route,/router\.post\('\/:id\/remove'/);
 assert.match(route,/router\.get\('\/removals'/);
 assert.match(ui,/Confirm employee removal|employeeRemoveForm/);
 assert.doesNotMatch(view,/removedEmployeeHistory|hrGovernance|peopleAccessTitle/);
 assert.match(read('public/admin.html'),/data-tab="permissions"/);
 assert.match(read('public/admin.html'),/data-audit-view="removals"/);
 assert.match(sql,/employee\.removed/);
 assert.match(sql,/removed_at is null/);
 assert.match(sql,/public\.internal_employee_command\(p_actor,'update'/);
 assert.match(sql,/authority->>'role'<>'owner'/);
});
