const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),{render}=require('../services/portal-page');
test('every portal page receives exactly one shared sidebar without losing module content',async()=>{
 for(const file of ['public/dashboard.html','views/projects.html','public/admin.html','views/hr-workspace.html','views/my-work.html','views/onboarding.html','views/account-profile.html']){
  const html=await render(await fs.readFile(file,'utf8'),{full_name:'Owner',platform_role:'super_admin'});
  assert.equal((html.match(/id="workspaceSidebar"/g)||[]).length,1,file);assert.equal((html.match(/id="logoutButton"/g)||[]).length,1,file);assert.match(html,/\/portal-navigation.js/);assert.match(html,/aria-controls="workspaceSidebar"/);assert.match(html,/href="\/hr\/access"/);assert.match(html,/<main\b/);
 }
});
test('rendered identity and notices cannot inject HTML and non-owner links start hidden',async()=>{
 const h=await render('<html><head></head><body><main>Own content</main></body></html>',{full_name:'<img src=x onerror=alert(1)>',platform_role:'user'},'<script>bad</script>');
 assert.doesNotMatch(h,/<img|<script>bad/);assert.match(h,/&lt;img/);assert.match(h,/id="adminNavContainer" hidden/);assert.match(h,/id="employeeNavContainer" hidden/);assert.match(h,/data-nav="employment" hidden/);assert.match(h,/Own content/);
});
test('identity replacement tokens stay literal on both existing and newly wrapped shells',async()=>{
 for(const source of [await fs.readFile('public/dashboard.html','utf8'),'<html><head></head><body><main>Own content</main></body></html>']){
  const h=await render(source,{full_name:"$& $' $`",platform_role:'user'});
  assert.ok(h.includes("$&amp; $&#39; $`"));assert.equal((h.match(/id="workspaceSidebar"/g)||[]).length,1);
 }
});
test('newly wrapped pages restore preferences without introducing unapproved inline scripts',async()=>{
 const h=await render(await fs.readFile('views/hr-workspace.html','utf8'),{full_name:'HR',platform_role:'user'});
 assert.match(h,/<script src="\/portal-prepaint.js"><\/script>/);assert.doesNotMatch(h,/<script>/);
});
