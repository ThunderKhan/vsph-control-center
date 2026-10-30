const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('redesigned dashboard retains real auth and application endpoints', () => {
  const html = read('public/dashboard.html');
  const js = read('public/dashboard.js');
  assert.match(html, /id="appGrid"/);
  assert.match(html, /id="appSearch"/);
  assert.match(html, /id="workspaceCount"/);
  assert.match(html, /id="logoutButton"/);
  assert.match(html, /id="adminNavContainer" hidden/);
  for (const endpoint of ['/api/auth/me', '/api/apps', '/api/workspaces', '/api/auth/logout']) {
    assert.ok(js.includes(endpoint), 'Missing ' + endpoint);
  }
  assert.doesNotMatch(html, /System online|Good to see you|Explore applications →|Activity Logs/);
  assert.doesNotMatch(js, /Math\.random|setInterval|fakeLatency|sampleThroughput/);
  assert.doesNotThrow(() => new Function(js));
});

test('product links are same-origin and constructed from validated product codes', () => {
  const js = read('public/dashboard.js');
  assert.ok(js.includes("link.href = '/apps/' + code.toLowerCase() + '/login'"));
  assert.ok(js.includes('/^[A-Z][A-Z0-9_]{1,39}$/i.test'));
  assert.ok(!js.includes('link.href = app.login_path'));
  assert.ok(js.includes('textContent = text'));
});

test('layout includes real responsive drawer and reduced-motion support', () => {
  const html = read('public/dashboard.html');
  const js = read('public/dashboard.js');
  const css = read('public/dashboard.css');
  assert.match(html, /aria-controls="workspaceSidebar"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="navBackdrop"/);
  assert.match(html, /href="#mainContent"/);
  assert.match(js, /Escape/);
  assert.match(js, /getClientRects\(\)/);
  assert.match(css, /max-width:950px/);
  assert.match(css, /max-width:680px/);
  assert.match(css, /max-width:400px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.spotlight-surface::after/);
  assert.match(css, /--navy: #00255A/);
  assert.match(css, /--action: #0069C8/);
  assert.ok(!html.includes('Explore applications →'));
  assert.ok(!html.includes('Open app →'));
});

function mount({ user, apps = [], workspaces = 0, unauthorized = false } = {}) {
  class FakeElement {
    constructor(id = '') {
      this.id = id; this.children = []; this.attributes = {};
      this.value = ''; this.textContent = ''; this.hidden = id === 'emptyMessage' || id === 'errorMessage' || id === 'adminNavContainer' || id === 'navBackdrop';
      this.disabled = false; this.events = {}; this.style = { setProperty() {} };
      this.classList = {
        add() {}, remove() {}, toggle() {}
      };
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, callback) { this.events[name] = callback; }
    focus() {}
    getBoundingClientRect() { return { left: 0, top: 0 }; }
    querySelectorAll() { return []; }
  }
  const nodes = new Map();
  const ids = [
    'appGrid', 'appSearch', 'errorMessage', 'emptyMessage', 'logoutButton',
    'avatar','sideName','sideRole','topAccount','welcomeMessage','adminNavContainer',
    'appCount','featureAppCount','workspaceCount','navBackdrop','openMenu','closeMenu',
    'workspaceSidebar','spotlightPanel'
  ];
  for (const id of ids) nodes.set(id, new FakeElement(id));
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({url,options});
    if (url === '/api/auth/me') return {
      status: unauthorized ? 401 : 200,
      ok: !unauthorized,
      json: async () => ({user: user || {name:'Example Member',platformRole:'user'}})
    };
    if (url === '/api/apps') return {status:200,ok:true,json:async()=>({applications:apps})};
    if (url === '/api/workspaces') return {status:200,ok:true,json:async()=>({count:workspaces})};
    if (url === '/api/auth/logout') return {status:200,ok:true,json:async()=>({})};
    throw new Error('Unexpected endpoint: '+url);
  };
  const location = {
    hash: '', replaced: null, replace(to) {this.replaced = to}
  };
  const document = {
    body: {classList:{add(){},remove(){},contains(){return false}}},
    activeElement: null,
    getElementById:id=>nodes.get(id),
    createElement:tag=>new FakeElement(tag),
    createElementNS:(ns,tag)=>new FakeElement(tag),
    querySelectorAll:()=>[],
    addEventListener(){}
  };
  const window = {
    innerWidth:1280, location, matchMedia:()=>({matches:true}), addEventListener(){}
  };
  vm.runInNewContext(read('public/dashboard.js'), {document,window,fetch,console});
  return {nodes, calls, location};
}

test('dashboard displays only authorized server-provided products and counts', async () => {
  const fixture = mount({
    user: {name:'Taylor Smith',platformRole:'super_admin'},
    workspaces:3,
    apps:[
      {code:'CRM',name:'Customer Relationship Management',status:'active',login_path:'https://attacker.invalid'},
      {code:'MUSIC',name:'Music Requests',status:'active',login_path:'/apps/music/login'},
      {code:'BAD/ROUTE',name:'Unsafe route',status:'active'},
      {code:'RETIRED',name:'Retired',status:'retired'}
    ]
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.nodes.get('appCount').textContent,'2');
  assert.equal(fixture.nodes.get('workspaceCount').textContent,'3');
  assert.equal(fixture.nodes.get('adminNavContainer').hidden,false);
  const cards = fixture.nodes.get('appGrid').children;
  assert.equal(cards.length,2);
  const links = cards.map(card => card.children[card.children.length-1]);
  assert.equal(links[0].href,'/apps/crm/login');
  assert.equal(links[1].href,'/apps/music/login');
  assert.equal(fixture.nodes.get('appGrid').attributes['aria-busy'],'false');
});

test('client users do not receive admin navigation and may filter their assigned applications', async () => {
  const fixture = mount({
    user: {name:'Sam User',platformRole:'user'},
    workspaces:1,
    apps:[{code:'CRM',name:'CRM',status:'active'},{code:'MUSIC',name:'Music',status:'active'}]
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.nodes.get('adminNavContainer').hidden,true);
  const search = fixture.nodes.get('appSearch');
  search.value = 'music';
  search.events.input();
  assert.equal(fixture.nodes.get('appGrid').children.length,1);
  assert.equal(fixture.nodes.get('appGrid').children[0].children[2].textContent,'Music');
});

test('unauthenticated dashboards redirect to portal login before requesting products', async () => {
  const fixture = mount({unauthorized:true});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.location.replaced,'/login');
  assert.ok(!fixture.calls.some(call => call.url === '/api/apps'));
});
