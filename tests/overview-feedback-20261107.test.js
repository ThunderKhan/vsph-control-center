const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {workspaceHeader}=require('../services/workspace-header');
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

test('account status moved to the shared avatar and never implies external verification',()=>{
 const active=workspaceHeader({full_name:'Test Employee',status:'active',platform_role:'user'},escape);
 assert.match(active,/class="crm-header-avatar-wrap"/);
 assert.match(active,/id="avatar"/);
 assert.match(active,/class="crm-avatar-status" title="Account active"/);
 assert.doesNotMatch(active,/verified account|identity verified/i);
 const inactive=workspaceHeader({full_name:'Disabled',status:'disabled',platform_role:'user'},escape);
 assert.doesNotMatch(inactive,/crm-avatar-status/);
 assert.doesNotMatch(inactive,/Account active/);
 const missing=workspaceHeader({full_name:'Unknown'},escape);
 assert.doesNotMatch(missing,/crm-avatar-status/);
});

test('dashboard removes the educational card and its active-account badge without deleting admin actions',()=>{
 const html=read('public/dashboard.html'),css=read('public/dashboard.css');
 for(const phrase of ['Two sign-ins. One workspace.','HOW IT WORKS','Portal access','Product verification','Work securely','Account active'])assert.equal(html.includes(phrase),false,phrase);
 assert.match(html,/id="adminOverviewPanel"/);
 assert.match(html,/id="overviewDetails"[^>]+hidden/);
 assert.match(read('public/dashboard.js'),/byId\('overviewDetails'\)\.hidden = !isPlatformAdmin/);
 assert.match(css,/\.overview-manage/);
 assert.doesNotMatch(css,/\.overview-help|\.access-steps/);
});

test('My Work shortcut is permission-controlled, never inferred from matching names',()=>{
 const nav=read('public/portal-navigation.js');
 const html=read('public/dashboard.html');
 assert.match(html,/id="myWorkShortcut"[^>]*href="\/dashboard#employeeDashboardWork" hidden/);
 assert.match(nav,/shortcut\.hidden=f\.employee!==true/);
 assert.doesNotMatch(nav,/name.*employee|name.*profile.*employee/);
 assert.match(nav,/catch\{const shortcut=\$\('myWorkShortcut'\);if\(shortcut\)shortcut\.hidden=true/);
 const css=read('public/portal-navigation.css');
 assert.match(css,/crm-avatar-status/);
 assert.match(css,/width:17px;height:17px/);
});
