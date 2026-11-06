const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),{render}=require('../services/portal-page');
test('every portal page receives exactly one shared top navigation without losing module content',async()=>{
 for(const file of ['public/dashboard.html','views/projects.html','public/admin.html','views/hr-workspace.html','views/my-work.html','views/onboarding.html','views/account-profile.html']){
  const html=await render(await fs.readFile(file,'utf8'),{full_name:'Owner',platform_role:'super_admin'});
  assert.equal((html.match(/id="workspaceNavigation"/g)||[]).length,1,file);assert.equal((html.match(/id="logoutButton"/g)||[]).length,1,file);assert.match(html,/\/portal-navigation.js/);assert.match(html,/aria-controls="workspaceNavigation"/);assert.match(html,/href="\/admin\?tab=permissions"/);assert.match(html,/<main\b/);assert.equal((html.match(/class="workspace-main"/g)||[]).length,1,file);assert.equal((html.match(/id="openMenu"/g)||[]).length,1,file);assert.doesNotMatch(html,/portal:sidebar|id="navBackdrop"|<script>/,file);
 }
});
test('rendered identity and notices cannot inject HTML and non-owner links start hidden',async()=>{
 const h=await render('<html><head></head><body><main>Own content</main></body></html>',{full_name:'<img src=x onerror=alert(1)>',platform_role:'user'},'<script>bad</script>');
 assert.doesNotMatch(h,/<img|<script>bad/);assert.match(h,/&lt;img/);assert.match(h,/id="adminNavContainer" class="portal-disclosure" hidden/);assert.match(h,/id="employeeNavContainer" hidden/);assert.match(h,/data-nav="employment"[^>]*hidden/);assert.match(h,/Own content/);
});
test('identity replacement tokens stay literal on both existing and newly wrapped shells',async()=>{
 for(const source of [await fs.readFile('public/dashboard.html','utf8'),'<html><head></head><body><main>Own content</main></body></html>']){
  const h=await render(source,{full_name:"$& $' $`",platform_role:'user'});
  assert.ok(h.includes("$&amp; $&#39; $`"));assert.equal((h.match(/id="workspaceNavigation"/g)||[]).length,1);
 }
});
test('newly wrapped pages restore preferences without introducing unapproved inline scripts',async()=>{
 const h=await render(await fs.readFile('views/hr-workspace.html','utf8'),{full_name:'HR',platform_role:'user'});
 assert.match(h,/<script src="\/portal-prepaint.js"><\/script>/);assert.doesNotMatch(h,/<script>/);
});
test('authenticated page denials retain navigation and status while API and anonymous errors stay unchanged',async()=>{
 const express=require('express'),{once}=require('node:events'),{middleware}=require('../services/portal-page'),app=express();
 app.use((req,res,next)=>{if(req.path!=='/anonymous')req.user={full_name:'Own account',platform_role:'user'};next();});app.use(middleware);
 app.get('/denied',(_req,res)=>res.status(403).send('<script>Untrusted denial</script>'));
 app.get('/api/denied',(_req,res)=>res.status(403).json({message:'Denied'}));app.get('/anonymous',(_req,res)=>res.status(403).send('Denied'));app.get('/asset.png',(_req,res)=>res.status(403).type('png').send('Denied'));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 try{const r=await fetch(origin+'/denied'),h=await r.text();assert.equal(r.status,403);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(h,/id="workspaceNavigation"/);assert.match(h,/&lt;script&gt;Untrusted denial/);assert.doesNotMatch(h,/<script>Untrusted/);const api=await fetch(origin+'/api/denied');assert.equal(api.status,403);assert.deepEqual(await api.json(),{message:'Denied'});const publicError=await fetch(origin+'/anonymous');assert.equal(publicError.status,403);assert.equal(await publicError.text(),'Denied');const asset=await fetch(origin+'/asset.png');assert.equal(asset.status,403);assert.match(asset.headers.get('content-type'),/^image\/png/);assert.equal(await asset.text(),'Denied');}
 finally{await new Promise(r=>server.close(r));}
});
test('CRM header keeps identity escaped, real navigation, hidden owner controls and no synthetic counters',async()=>{
 const html=await render('<html><head></head><body><main>Existing workflow</main></body></html>',{full_name:'<img src=x>',platform_role:'user'});
 assert.match(html,/crm-workspace.css/);assert.match(html,/workspace-search.js/);assert.match(html,/id="workspaceSearch"/);assert.match(html,/id="topbarOnboard"[^>]*hidden/);assert.doesNotMatch(html,/<img/);assert.match(html,/Existing workflow/);
 assert.equal((html.match(/id="openMenu"/g)||[]).length,1);
});
