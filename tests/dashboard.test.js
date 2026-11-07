const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Overview and Applications use distinct protected routes and separate views', () => {
  const html = read('public/dashboard.html')+read('views/partials/portal-navigation.html');
  const server = read('server.js');
  const js = read('public/dashboard.js');
  for(const route of ["'/dashboard'","'/applications'","'/admin'"]) {
    assert.ok(server.includes(route), route);
  }
  assert.ok(server.includes("app.get('/dashboard.html',(req,res)=>res.redirect(302,'/dashboard'))"));
  assert.ok(server.includes("app.get('/applications.html',(req,res)=>res.redirect(302,'/applications'))"));
  assert.ok(server.includes("app.get('/admin.html',(req,res)=>res.redirect(302,'/admin'))"));
  assert.match(html, /id="accessGrid"/);
  assert.match(html, /id="myWorkShortcut"[^>]*href="\/my-work" hidden/);
  assert.match(html, /id="overviewDetails"[^>]*hidden/);
  assert.doesNotMatch(html, /Two sign-ins\. One workspace\.|HOW IT WORKS|Account active/);
  assert.match(html, /id="appGrid"/);
  assert.match(html, /data-view="overview"/);
  assert.match(html, /data-view="applications"/);
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /href="\/applications"/);
  assert.match(html, /href="\/admin"/);
  assert.match(html, /id="topbarOnboard"[^>]*hidden/);
  assert.match(html, /class="portal-link" href="\/admin\/onboarding"/);
  assert.match(js, /location.pathname/);
  assert.match(js, /renderAccessOverview/);
  assert.match(js, /\/contexts/);
  assert.doesNotMatch(html, /href="[^"]*\.html"/);
});

test('dashboard design is responsive and does not fabricate analytics', () => {
  const css=read('public/dashboard.css');
  const js=read('public/dashboard.js');
  assert.match(css, /max-width:950px/);
  assert.match(css, /max-width:680px/);
  assert.match(css, /max-width:400px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.access-grid/);
  assert.match(css, /\.overview-details/);
  assert.match(css, /--navy: #00255A/);
  assert.match(css, /--action: #0069C8/);
  assert.doesNotMatch(js,/Math\.random|setInterval|fakeLatency|sampleThroughput/);
  assert.doesNotThrow(()=>new Function(js));
});

function mount({pathname='/dashboard',user,apps=[],workspaces=0,unauthorized=false,employeeAuthorized=false,employeeIdentityInbox={employment:[],requests:[]},contexts={},collapsed=false,blockedStorage=false}={}){
  class Element{
    constructor(id=''){
      this.id=id; this.children=[]; this.attributes={}; this.value=''; this.textContent='';
      this.hidden=['emptyMessage','errorMessage','adminNavContainer','adminOverviewPanel','topbarOnboard','navBackdrop','employeeDashboard','employeeActivitySetup','workActivity','employeeDashboardActions'].includes(id);
      this.disabled=false; this.events={}; this.style={setProperty(){}};
      this.classList={add(){},remove(){},toggle(){},contains(){return false}};
    }
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=nodes;}
    setAttribute(k,v){this.attributes[k]=v;}
    getAttribute(k){return this.attributes[k]||null;}
    removeAttribute(k){delete this.attributes[k];}
    addEventListener(k,callback){this.events[k]=callback;}
    getBoundingClientRect(){return{left:0,top:0};}
    getClientRects(){return [1];}
    querySelectorAll(){return[];}
    focus(){}
  }
  const ids=['appGrid','appSearch','errorMessage','emptyMessage','logoutButton','avatar','sideName','sideRole','topAccount','welcomeMessage','adminNavContainer','adminOverviewPanel','overviewDetails','topbarOnboard','appCount','featureAppCount','workspaceCount','navBackdrop','openMenu','closeMenu','sidebarToggle','workspaceSidebar','spotlightPanel','accessGrid','libraryCount','employeeNavContainer','hrGovernanceNav','myWorkNav','employeeDashboard','employeeDashboardWelcome','employeeDashboardActions','workActivity','employeeActivitySetup','employeeActivitySetupTitle','employeeActivitySetupMessage','employeeActivitySetupAction'];
  const nodes=new Map(ids.map(id=>[id,new Element(id)]));
  const visibleViews=[];
  for(const name of ['overview','applications']){
    const node=new Element(name);node.attributes['data-view']=name;visibleViews.push(node);
  }
  const links=[];
  for(const url of ['/dashboard','/applications','/admin']){
    const node=new Element(url);node.attributes.href=url;links.push(node);
  }
  const calls=[],activity={loads:0};
  const fetch=async (url,options={})=>{
    calls.push({url,options});
    if(url==='/api/auth/me')return{status:unauthorized?401:200,ok:!unauthorized,json:async()=>({user:user||{name:'Example Member',platformRole:'user'}})};
    if(url==='/api/hrms/access')return{status:200,ok:true,json:async()=>({employee:employeeAuthorized,pendingLink:employeeIdentityInbox.requests.length>0})};
    if(url==='/api/employee-identity/mine')return{status:200,ok:true,json:async()=>employeeIdentityInbox};
    if(url==='/api/apps')return{status:200,ok:true,json:async()=>({applications:apps})};
    if(url==='/api/workspaces')return{status:200,ok:true,json:async()=>({count:workspaces})};
    if(url.startsWith('/api/apps/')&&url.endsWith('/contexts')){
      const code=url.split('/')[3];
      return{status:200,ok:true,json:async()=>({organizations:contexts[code]||[]})};
    }
    if(url==='/api/auth/logout')return{status:200,ok:true,json:async()=>({})};
    throw Error('Unexpected endpoint '+url);
  };
  const location={pathname,hash:'',replaced:null,replace(url){this.replaced=url;}};
  const document={
    title:'',documentElement:{dataset:{sidebarState:collapsed?'collapsed':'expanded'}},
    body:{classList:{add(){},remove(){},contains(){return false}}},
    activeElement:null,
    getElementById:id=>nodes.get(id),
    querySelectorAll:selector=>selector==='[data-view]'?visibleViews:selector==='[data-view="overview"]'?visibleViews.filter(v=>v.attributes['data-view']==='overview'):selector==='.sidebar-link'?links:[],
    createElement:tag=>new Element(tag),
    createElementNS:(ns,tag)=>new Element(tag),
    addEventListener(){}
  };
  const stored=new Map();
  const localStorage={
    setItem(key,value){if(blockedStorage)throw Error('Storage blocked');stored.set(key,value);},
    getItem(key){if(blockedStorage)throw Error('Storage blocked');return stored.get(key)||null;}
  };
  const window={innerWidth:1280,location,localStorage,matchMedia:()=>({matches:true}),addEventListener(){},
   VSPHWorkActivity:{load(){activity.loads++;}}};
  vm.runInNewContext(read('public/dashboard.js'),{document,window,fetch,console,URLSearchParams,AbortSignal:{timeout(){return {};}}});
  return{nodes,calls,activity,location,visibleViews,links,document,stored,window};
}
async function settle(){await new Promise(resolve=>setImmediate(resolve));}

test('Overview uses real product roles and customer contexts rather than repeating the app directory',async()=>{
  const fixture=mount({
    user:{name:'Taylor Smith',platformRole:'super_admin'},
    apps:[{code:'CRM',name:'CRM',status:'active'},{code:'MUSIC',name:'Music',status:'active'}],
    workspaces:3,
    contexts:{CRM:[{name:'Alpha',role:'admin'},{name:'Beta',role:'viewer'}],MUSIC:[{name:'Venue',role:'manager'}]}
  });
  await settle();
  assert.equal(fixture.document.title,'Overview | VSPH Control Center');
  assert.equal(fixture.nodes.get('appCount').textContent,'2');
  assert.equal(fixture.nodes.get('workspaceCount').textContent,'3');
  assert.equal(fixture.nodes.get('adminOverviewPanel').hidden,false);
  assert.equal(fixture.nodes.get('overviewDetails').hidden,false);
  assert.equal(fixture.nodes.get('topbarOnboard').hidden,false);
  assert.equal(fixture.nodes.get('accessGrid').children.length,2);
  assert.equal(fixture.nodes.get('appGrid').children.length,0);
  assert.ok(fixture.calls.some(x=>x.url==='/api/apps/CRM/contexts'));
  assert.ok(fixture.calls.some(x=>x.url==='/api/apps/MUSIC/contexts'));
  const first=fixture.nodes.get('accessGrid').children[0];
  assert.equal(first.children[2].href,'/apps/crm/launch');
  assert.equal(first.children[1].children[0].textContent,'admin, viewer');
  assert.equal(fixture.visibleViews[0].hidden,false);
  assert.equal(fixture.visibleViews[1].hidden,true);
});

test('Applications is a separate searchable directory with only server-authorized products',async()=>{
  const fixture=mount({
    pathname:'/applications',
    user:{name:'Sam User',platformRole:'user'},workspaces:1,
    apps:[
      {code:'CRM',name:'CRM',status:'active',login_path:'https://external.invalid'},
      {code:'MUSIC',name:'Music',status:'active'},
      {code:'BAD/ROUTE',name:'Unsafe',status:'active'},
      {code:'OLD',name:'Retired',status:'retired'}
    ]
  });
  await settle();
  assert.equal(fixture.document.title,'Applications | VSPH Control Center');
  assert.equal(fixture.nodes.get('topbarOnboard').hidden,true);
  assert.equal(fixture.nodes.get('appGrid').children.length,2);
  assert.equal(fixture.nodes.get('accessGrid').children.length,0);
  assert.equal(fixture.nodes.get('libraryCount').textContent,'2 products');
  assert.equal(fixture.nodes.get('appGrid').children[0].children.at(-1).href,'/apps/crm/launch');
  assert.equal(fixture.visibleViews[0].hidden,true);
  assert.equal(fixture.visibleViews[1].hidden,false);
  const search=fixture.nodes.get('appSearch');
  search.value='music';
  search.events.input();
  assert.equal(fixture.nodes.get('appGrid').children.length,1);
  assert.equal(fixture.nodes.get('libraryCount').textContent,'1 product');
  assert.equal(fixture.nodes.get('appGrid').children[0].children[2].textContent,'Music');
});

test('unauthenticated direct dashboard access navigates to portal login without loading products',async()=>{
  const fixture=mount({pathname:'/applications',unauthorized:true});
  await settle();
  assert.equal(fixture.location.replaced,'/login');
  assert.ok(!fixture.calls.some(call=>call.url==='/api/apps'));
});

test('linked staff get the dashboard-first heatmap without loading customer application metrics',async()=>{
 const fixture=mount({user:{name:'Staff Example',platformRole:'user'},employeeAuthorized:true});
 await settle();
 assert.equal(fixture.document.title,'My dashboard | VSPH Control Center');
 assert.equal(fixture.nodes.get('employeeDashboard').hidden,false);
 assert.equal(fixture.nodes.get('employeeDashboardWelcome').textContent,'Welcome back, Staff. Your work, at a glance.');
 assert.equal(fixture.visibleViews[0].hidden,true);
 assert.equal(fixture.activity.loads,1);
 assert.equal(fixture.nodes.get('workActivity').hidden,false);
 assert.equal(fixture.nodes.get('employeeDashboardActions').hidden,false);
 assert.equal(fixture.nodes.get('employeeActivitySetup').hidden,true);
 assert.ok(fixture.calls.some(x=>x.url==='/api/hrms/access'));
 assert.equal(fixture.calls.some(x=>x.url==='/api/apps'),false);
});
test('ordinary customer cannot see the employee widget or request its data',async()=>{
 const fixture=mount({user:{name:'Customer Example',platformRole:'user'},employeeAuthorized:false});
 await settle();
 assert.equal(fixture.nodes.get('employeeDashboard').hidden,true);
 assert.equal(fixture.activity.loads,0);
 assert.equal(fixture.document.title,'Overview | VSPH Control Center');
 assert.equal(fixture.visibleViews[0].hidden,false);
});
test('page header labels are removed without affecting section labels or navigation',()=>{
 const html=read('public/dashboard.html');
 for(const label of ['WORKSPACE / OVERVIEW','WORKSPACE / APPLICATIONS','VSPH / PLATFORM OWNER','VSPH / EXECUTIVE OVERVIEW']){
   assert.equal(html.includes(label),false,label);
 }
 assert.doesNotMatch(read('views/projects.html'),/WORKSPACE \/ PROJECTS/);
 assert.match(html,/ACCESS SUMMARY|PRODUCT DIRECTORY/);
 assert.match(html,/id="ownerOverviewTitle"|id="pageTitle"/);
 assert.match(read('views/partials/portal-navigation.html'),/aria-label="Main"/);
});

test('accepted link to onboarding roster shows actionable employee-first setup without exposing work data',async()=>{
 const f=mount({user:{name:'Setup Employee',platformRole:'user'},employeeAuthorized:false,
  employeeIdentityInbox:{employment:[{status:'onboarding',full_name:'Setup Employee'}],requests:[]}});
 await settle();
 assert.equal(f.document.title,'My dashboard | VSPH Control Center');
 assert.equal(f.nodes.get('employeeDashboard').hidden,false);
 assert.equal(f.nodes.get('employeeActivitySetup').hidden,false);
 assert.equal(f.nodes.get('employeeActivitySetupTitle').textContent,'Your employee record is still onboarding');
 assert.equal(f.nodes.get('employeeDashboardActions').hidden,true);
 assert.match(f.nodes.get('employeeActivitySetupMessage').textContent,/HR must change your roster status to Active/);
 assert.equal(f.nodes.get('employeeActivitySetupAction').textContent,'View your employment record');
 assert.equal(f.nodes.get('workActivity').hidden,true);
 assert.equal(f.activity.loads,0);
 assert.equal(f.calls.some(x=>x.url==='/api/apps'),false);
});
test('pending identity-link requests have a safe acceptance next step',async()=>{
 const f=mount({user:{name:'Pending Employee',platformRole:'user'},employeeAuthorized:false,
 employeeIdentityInbox:{employment:[],requests:[{id:'some-request'}]}});
 await settle();
 assert.equal(f.nodes.get('employeeDashboard').hidden,false);
 assert.equal(f.nodes.get('employeeActivitySetup').hidden,false);
 assert.equal(f.nodes.get('employeeDashboardActions').hidden,true);
 assert.match(f.nodes.get('employeeActivitySetupMessage').textContent,/Review and accept/);
 assert.equal(f.nodes.get('workActivity').hidden,true);
 assert.equal(f.activity.loads,0);
});
test('unlinked customer has no employee setup, no heatmap and no access data',async()=>{
 const f=mount({user:{name:'Customer Member',platformRole:'user'},employeeAuthorized:false});
 await settle();
 assert.equal(f.nodes.get('employeeActivitySetup').hidden,true);
 assert.equal(f.nodes.get('employeeDashboard').hidden,true);
 assert.equal(f.nodes.get('workActivity').hidden,true);
 assert.equal(f.activity.loads,0);
});
