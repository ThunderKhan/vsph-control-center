const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('top navigation uses a full-width page with no sidebar or icon rail',()=>{
 const css=fs.readFileSync('public/portal-navigation.css','utf8'),nav=fs.readFileSync('views/partials/portal-navigation.html','utf8');
 assert.match(css,/display:block!important/);assert.match(css,/grid-template-columns:none!important/);assert.match(nav,/<nav id="workspaceNavigation"/);assert.doesNotMatch(nav,/<aside|sidebarToggle|workspaceSidebar/);
 for(const label of ['Overview','Applications','Platform Administration','New Customer'])assert.ok(nav.includes('aria-label="'+label+'"'));
 for(const group of ['Work','Organizations','Applications','People','Administration'])assert.match(nav,new RegExp('<summary>'+group));
 assert.doesNotMatch(nav,/href="\/search" aria-label="Search work"/);
});
test('native disclosures and mobile top menu retain keyboard targets and current-route marking',()=>{
 const script=fs.readFileSync('public/portal-navigation.js','utf8'),header=fs.readFileSync('services/workspace-header.js','utf8');
 assert.match(header,/aria-controls="workspaceNavigation"/);assert.match(script,/ArrowDown/);assert.match(script,/Escape/);assert.match(script,/aria-current/);assert.doesNotMatch(script,/localStorage|sidebarState|\.inert/);
});
test('old stored rail preferences are ignored while the first-paint applications view remains correct',()=>{
 const source=fs.readFileSync('public/portal-prepaint.js','utf8');
 for(const path of ['/dashboard','/applications','/applications/']){const root={dataset:{sidebarState:'collapsed'}};vm.runInNewContext(source,{document:{documentElement:root},location:{pathname:path},localStorage:{getItem(){throw Error('Storage must not be read');}}});assert.equal(root.dataset.sidebarState,undefined);assert.equal(root.dataset.workspaceView,path.startsWith('/applications')?'applications':'overview');}
 assert.doesNotMatch(fs.readFileSync('public/dashboard.html','utf8'),/<script>|navBackdrop|portal:sidebar/);
});
