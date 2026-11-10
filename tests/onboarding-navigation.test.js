const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('main workspace exposes platform-only customer onboarding navigation',()=>{
 const dashboard=read('public/dashboard.html')+read('views/partials/portal-navigation.html'),script=read('public/dashboard.js');
 const server=read('server.js'),admin=read('public/admin.html');
 assert.match(dashboard,/id="topbarOnboard"[^>]*hidden/);
 assert.match(dashboard,/id="orgAdminNav" hidden>[\s\S]*?href="\/admin\/onboarding"/);
 assert.doesNotMatch(dashboard,/MANAGEMENT|Customers, products and permissions|sidebar-onboarding/);
 const adminLinks=[...dashboard.matchAll(/<a class="portal-link"[^>]*href="\/(?:admin|admin\/onboarding)"/g)];
 assert.equal(adminLinks.length,2,'Platform administration and New customer must use the same top navigation link class');
 const css=read('public/dashboard.css');
 assert.doesNotMatch(css,/\.sidebar-onboarding|\.nav-help|\.nav-label-secondary/);
 assert.match(script,/byId\('topbarOnboard'\)\.hidden = !isPlatformAdmin/);
 assert.match(script,/const isPlatformAdmin = user\.platformRole === 'super_admin'/);
 assert.match(server,/app\.get\(\['\/admin\/onboarding','\/admin\/onboarding\/'\],portalSession,requireAdmin/);
 assert.match(admin,/class="admin-return onboarding-cta" href="\/admin\/onboarding"/);
});

test('central portal login links to invitation help without enabling unsolicited account creation',()=>{
 const login=read('views/auth.html'),script=read('public/auth-page.js');
 assert.match(login,/id="inviteEntry"[^>]+hidden/);
 assert.match(login,/href="\/accept-invite"/);
 assert.match(script,/byId\('inviteEntry'\)\.hidden = false/);
 assert.doesNotMatch(login,/href="\/signup"/);
});


test('employee onboarding remains accessible from the directory but not the People menu',()=>{
 const nav=read('views/partials/portal-navigation.html'),directory=read('views/employees.html');
 assert.match(nav,/href="\/employees" aria-label="Employee Management"/);
 assert.doesNotMatch(nav,/href="\/employees\/onboarding"/);
 assert.match(directory,/class="people-primary" href="\/employees\/onboarding">Onboard employee<\/a>/);
});
