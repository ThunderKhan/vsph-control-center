const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=pathName=>fs.readFileSync(path.join(root,pathName),'utf8');

test('desktop sidebar uses an animating grid track, so the main area reflows',()=>{
  const css=read('public/dashboard.css');
  assert.match(css,/\.workspace-shell\s*\{transition:grid-template-columns/);
  assert.match(css,/@media\s*\(min-width:951px\)/);
  assert.match(css,/:root\[data-sidebar-state="collapsed"\] \.workspace-shell\s*\{\s*grid-template-columns:72px minmax\(0,1fr\)/);
  assert.match(css,/\.workspace-shell\s*\{min-height:100vh;display:grid;grid-template-columns:256px minmax\(0,1fr\)/);
  assert.match(css,/@media\(max-width:950px\)\s*\{[\s\S]*?\.workspace-shell\s*\{display:block\}/);
  assert.match(css,/@media\(max-width:950px\)\s*\{[\s\S]*?\.sidebar-heading\{position:static\}[\s\S]*?\.sidebar-collapse-toggle\{display:none\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\s*\{\s*\.workspace-shell,\.sidebar-collapse-toggle\{transition:none!important\}/);
});

test('icon rail keeps real accessible links and native disclosure toggle',()=>{
  const html=read('public/dashboard.html'),css=read('public/dashboard.css');
  assert.match(html,/id="sidebarToggle" class="sidebar-collapse-toggle" type="button"/);
  assert.match(html,/aria-expanded="true" aria-controls="workspaceSidebar"/);
  for(const label of ['Overview','Applications','Platform administration','New customer']){
    assert.ok(html.includes('aria-label="'+label+'"'),label);
    assert.ok(html.includes('title="'+label+'"'),label);
  }
  assert.match(html,/id="logoutButton"[^>]+aria-label="Sign out"/);
  assert.match(css,/:root\[data-sidebar-state="collapsed"\] \.sidebar-link>span/);
  assert.match(css,/:root\[data-sidebar-state="collapsed"\] \.account-details/);
  assert.match(css,/:root\[data-sidebar-state="collapsed"\] \.sidebar-collapse-toggle/);
});

test('stored preference loads in head before the sidebar markup, without breaking private browsing',()=>{
  const html=read('public/dashboard.html');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'inline pre-paint script');
  const simulate=(saved,blocked=false)=>{
    const root={dataset:{}};
    const context={
      document:{documentElement:root},
      location:{pathname:'/applications'},
      localStorage:{getItem(k){assert.equal(k,'vsph.sidebar.collapsed');if(blocked)throw Error('private');return saved}}
    };
    vm.runInNewContext(script,context);
    return root.dataset;
  };
  assert.equal(simulate('true').sidebarState,'collapsed');
  assert.equal(simulate('false').sidebarState,'expanded');
  assert.equal(simulate(null).sidebarState,'expanded');
  assert.equal(simulate('true',true).sidebarState,'expanded');
  assert.equal(simulate('true').workspaceView,'applications');
});
