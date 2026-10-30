require('dotenv').config();
const express=require('express');const path=require('node:path');const cookieParser=require('cookie-parser');
const {db,configured}=require('./db');
const {portalSession,optionalPortal,requireAdmin,requireApp,validateOrigin,getApp,getContexts}=require('./security');
const musicSso=require('./routes/sso');
const {musicConfig}=require('./integration/sso-config');
const {securityHeaders,trustProxy,rateLimit,safeError}=require('./http-security');
const app=express();app.disable('x-powered-by');app.set('trust proxy',trustProxy());
app.use(securityHeaders);
// All applications use this login view by default. Explicit, reviewed overrides
// can be placed here later for a customer's structural requirements.
const sharedAuthView = path.join(__dirname,'views','auth.html');
const authViews = Object.freeze({
  // CRM: path.join(__dirname,'views','crm-special-login.html')
});
app.use(express.json({limit:'100kb',strict:true}));app.use(express.urlencoded({extended:false,limit:'100kb',parameterLimit:50}));app.use(cookieParser());
// Applied before credential verification and confidential SSO lookups. No body or token is a limiter key.
app.use(['/api/auth/login','/api/auth/app-login','/api/invitations/accept','/api/invitations/inspect'],rateLimit({limit:20,windowMs:15*60*1000}));
app.use(['/api/sso/exchange','/api/sso/introspect'],rateLimit({limit:300,windowMs:60*1000}));
// The Music server exchanges a one-time code without a browser Origin header.
// This exception requires its own confidential client authentication.
app.post('/api/sso/exchange',musicSso.exchange);
app.post('/api/sso/introspect',musicSso.introspect);
app.use(validateOrigin);
// Authenticated HTML and session-dependent API responses must not be stored by
// browser/proxy caches; navigating Back after logout should trigger a fresh check.
app.use((req,res,next)=>{
 const url=(String(req.originalUrl||'').split('?')[0].replace(/\/+$/, '') || '/');
 if(url.startsWith('/api/sso/') || url.startsWith('/api/invitations/') || url.startsWith('/api/admin-management/') || url.startsWith('/api/auth/') || url==='/api/apps' || url.startsWith('/api/apps/') ||
    url.startsWith('/apps/') || ['/', '/login', '/login.html', '/index.html',
    '/dashboard','/applications','/admin','/admin/onboarding','/accept-invite','/dashboard.html','/applications.html','/admin.html'].includes(url)) {
   res.set('Cache-Control','no-store');
 }
 next();
});
app.use('/api/auth',require('./routes/auth'));
app.use('/api/invitations',require('./routes/invitations'));

app.use('/api/projects',require('./routes/projects').router);
app.get(['/projects','/projects/:id'],portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','projects.html'))});
app.use('/api/apps',require('./routes/apps'));
app.use('/api/sso',musicSso.router);
app.use('/api/workspaces',require('./routes/workspaces'));
app.use('/api/admin-management',portalSession,requireAdmin,require('./routes/admin-management'));
app.use('/api/admin-management/onboardings',portalSession,requireAdmin,require('./routes/onboarding').router);
app.get('/admin/provisioning',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','provisioning.html'))});
app.get('/api/health',async(req,res)=>{
 if(!configured())return res.status(503).json({status:'not_configured',database:false});
 try{const{error}=await db().from('applications').select('id').limit(1);if(error)throw error;
 res.json({status:'ok',database:true});}catch(e){res.status(503).json({status:'database_unavailable',database:false})}
});
app.get('/apps/:app/launch',portalSession,async(req,res,next)=>{
  try{
    const application=await getApp(req.params.app);
    if(!application || application.status!=='active')return res.status(404).send('Application unavailable.');
    const contexts=await getContexts(req.user,application);
    if(!contexts.length)return res.status(403).send('No access to this application.');
    // Preserve existing second-stage sign-in unless a trusted Music receiver
    // is configured. No redirect to arbitrary database-supplied login_path.
    if(application.code!=='MUSIC' || !musicConfig())
      return res.redirect(302,'/apps/'+application.code.toLowerCase()+'/login');
    res.sendFile(path.join(__dirname,'views','sso-launch.html'));
  }catch(err){next(err)}
});
app.get('/apps/:app/login',portalSession,async(req,res,next)=>{
 try{const application=await getApp(req.params.app);
 if(!application||application.status!=='active')return res.status(404).send('Application unavailable.');
 const contexts=await getContexts(req.user,application);
 if(!contexts.length)return res.status(403).send('No access to this application.');
 res.sendFile(authViews[application.code] || sharedAuthView);
 }catch(e){next(e)}
});
app.get('/apps/:app/home',portalSession,requireApp,(req,res)=>res.sendFile(path.join(__dirname,'public','app-home.html')));
// Login, dashboard, and admin pages are served explicitly; protected pages cannot be bypassed by static hosting.
// Clean, independently navigable routes. Overview and Applications share
// layout assets but render distinct views based on the URL.
app.get(['/dashboard','/dashboard/'],portalSession,(req,res)=>res.sendFile(path.join(__dirname,'public','dashboard.html')));
app.get(['/applications','/applications/'],portalSession,(req,res)=>res.sendFile(path.join(__dirname,'public','dashboard.html')));
app.get(['/admin','/admin/'],portalSession,requireAdmin,(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get(['/admin/onboarding','/admin/onboarding/'],portalSession,requireAdmin,(req,res)=>
  res.sendFile(path.join(__dirname,'views','onboarding.html')));
app.get(['/accept-invite','/accept-invite/'],(req,res)=>
  res.sendFile(path.join(__dirname,'views','accept-invite.html')));
// Legacy bookmarks redirect, with all authorization performed by the destination.
app.get('/dashboard.html',(req,res)=>res.redirect(302,'/dashboard'));
app.get('/applications.html',(req,res)=>res.redirect(302,'/applications'));
app.get('/admin.html',(req,res)=>res.redirect(302,'/admin'));
app.get('/index.html',(req,res)=>res.redirect(302,'/login'));
app.use((req,res,next)=>['/app-home.html','/app-login.html'].includes(req.path)?res.status(404).send('Not found.'):next());
// Friendly routes keep file extensions out of public URLs without changing the HTML/Express stack.
app.get(['/', '/login'],optionalPortal,(req,res)=>{
  // Decide before sending HTML: a live session never sees a login-form flash.
  if(req.user)return res.redirect(302,'/dashboard');
  res.sendFile(sharedAuthView);
});
app.get('/login.html',(req,res)=>res.redirect(302,'/login'));
app.use(express.static(path.join(__dirname,'public'),{index:false}));
app.use(safeError);
const port=Number(process.env.PORT||3000);
if(require.main===module)app.listen(port,()=>console.log(`VSPH Control Center → http://localhost:${port}`));
module.exports=app;

