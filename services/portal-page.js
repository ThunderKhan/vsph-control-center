const fs=require('node:fs/promises'),path=require('node:path');
const {workspaceHeader}=require('./workspace-header');
const root=path.resolve(__dirname,'..');
const allowed=new Set(['dashboard.html','admin.html','app-home.html'].map(f=>path.join(root,'public',f)).concat(['auth','account-profile','customers','employee-identity','employee-onboarding','employees','finance-journal','finance','hr-access','hr-workspace','my-work','onboarding','organizations','products','projects','provisioning','search','sso-launch'].map(f=>path.join(root,'views',f+'.html'))));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const prepaint='<script src="/portal-prepaint.js"></script>';
let template;
async function render(html,user,notice){
 template??=await fs.readFile(path.join(root,'views/partials/portal-sidebar.html'),'utf8');
 let side=template.match(/<aside[\s\S]*<\/aside>/)[0],icons=template.match(/<svg class="icon-library"[\s\S]*?<\/svg>/)[0];
 side=side.replace('Your account',()=>escape(user.full_name||'Your account')).replace('Loading account',user.platform_role==='super_admin'?'Platform owner':'Workspace member');
 if(user.platform_role==='super_admin')side=side.replace('id="adminNavContainer" hidden','id="adminNavContainer"').replace('id="employeeNavContainer" hidden','id="employeeNavContainer"').replace(/(id="hrGovernanceNav"[^>]*?) hidden/,'$1');
 // Existing main content and module scripts retain their identity and state.
 if(html.includes('<!-- portal:sidebar -->')){
  html=html.replace('<!-- portal:sidebar -->',()=>side).replace('<!-- portal:icons -->',()=>icons);
 }else{
  const header='<header class="workspace-topbar"><div class="mobile-brand"><button id="openMenu" class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="workspaceSidebar"><svg class="icon" aria-hidden="true"><use href="#icon-menu"></use></svg></button><span>VSPH</span></div><div class="topbar-context">CONTROL CENTER</div><span id="topAccount" class="topbar-account">'+escape(user.full_name||'Your account')+'</span></header>';
  // The old admin sign-out control is replaced by the common footer control.
  if(/<title>Administration/.test(html))html=html.replace(/<button[^>]*id="logoutButton"[\s\S]*?<\/button>/,'');
  html=html.replace(/(<body\b[^>]*>)/,match=>match+icons+'<a class="skip-link" href="#portalContent">Skip to content</a><div class="workspace-shell"><button id="navBackdrop" class="nav-backdrop" type="button" aria-label="Close navigation" hidden></button>'+side+'<div class="workspace-main">'+header+'<div id="portalContent" tabindex="-1">').replace('</body>','</div></div></div></body>');
 }
 html=html.replace(/<header class="workspace-topbar"[\s\S]*?<\/header>/,()=>workspaceHeader(user,escape));
 html=html.replace(/<body\b([^>]*)>/,(_m,attrs)=>'<body'+attrs+' data-portal-shell="true" data-portal-owner="'+(user.platform_role==='super_admin')+'">');
 if(notice)html=html.replace(/(<div class="workspace-main"[^>]*>)/,match=>match+'<div class="portal-environment-notice" role="note">'+escape(notice)+'</div>');
 return html.replace('</head>',prepaint+'<link rel="stylesheet" href="/portal-navigation.css"><link rel="stylesheet" href="/crm-workspace.css"><script defer src="/portal-navigation.js"></script><script defer src="/workspace-search.js"></script></head>');
}
// Only reviewed authenticated HTML sendFile paths are decorated. APIs, public
// login/invitation pages, assets and route authorization remain untouched.
function middleware(req,res,next){
 const original=res.sendFile.bind(res),send=res.send.bind(res);
 // Authenticated page denials keep a route back to the user's workspace.
 // Status codes and JSON/API contracts are never converted into success HTML.
 res.send=function(body){
  const type=String(res.get('Content-Type')||'');
  const pageType=!type||/^text\/(?:html|plain)(?:;|$)/i.test(type);
  const extension=path.extname(req.path||'').toLowerCase(),asset=extension&&extension!=='.html';
  if(!req.user||req.method!=='GET'||/^\/api(?:\/|$)/i.test(req.path)||res.statusCode<400||!pageType||asset||typeof body!=='string'||res.locals.portalErrorRendered)return send(body);
  res.locals.portalErrorRendered=true;
  const status=res.statusCode,title=status===403?'Access denied':'Page unavailable';
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | VSPH</title><link rel="stylesheet" href="/operations.css"></head><body><main class="project-page"><h1>'+title+'</h1><p>'+escape(body)+'</p><a class="button" href="/dashboard">Return to your workspace</a></main></body></html>';
  render(html,req.user,res.app.locals.environmentNotice).then(h=>{res.status(status).set('Cache-Control','no-store').type('html');send(h);}).catch(next);
  return res;
 };
 res.sendFile=function(file,...args){if(!req.user||!allowed.has(file))return original(file,...args);fs.readFile(file,'utf8').then(h=>render(h,req.user,res.app.locals.environmentNotice)).then(h=>res.set('Cache-Control','no-store').type('html').send(h)).catch(next);return res;};next();
}
module.exports={middleware,render};
