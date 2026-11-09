require('dotenv').config({quiet:true});
const express=require('express');const path=require('node:path');const cookieParser=require('cookie-parser');
const {db,configured}=require('./db');
const {portalSession,optionalPortal,requireAdmin,requireApp,validateOrigin,getApp,getContexts}=require('./security');
const musicSso=require('./routes/sso');
const {musicConfig}=require('./integration/sso-config');
const {securityHeaders,trustProxy,rateLimit,safeError}=require('./http-security');
const app=express();app.disable('x-powered-by');app.set('trust proxy',trustProxy());
app.use(securityHeaders);
app.use(require('./services/portal-page').middleware);
// All applications use this login view by default. Explicit, reviewed overrides
// can be placed here later for a customer's structural requirements.
const sharedAuthView = path.join(__dirname,'views','auth.html');
const authViews = Object.freeze({
  // CRM: path.join(__dirname,'views','crm-special-login.html')
});
app.post('/api/integrations/github/webhook',rateLimit({limit:300,windowMs:60000}),express.raw({type:'application/json',limit:'1mb'}),require('./routes/delivery').webhook());
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
 if(url.startsWith('/api/sso/') || url.startsWith('/api/invitations/') || url.startsWith('/api/admin-management/') || url.startsWith('/api/auth/') || url==='/api/apps' || url.startsWith('/api/apps/') || url.startsWith('/api/employee-identity') || url.startsWith('/api/employees') || url.startsWith('/api/finance') ||
    url.startsWith('/apps/') || ['/', '/login', '/login.html', '/index.html',
    '/dashboard','/applications','/employment','/employees','/employees/onboarding','/admin','/admin/onboarding','/admin/finance','/admin/finance/journal','/accept-invite','/dashboard.html','/applications.html','/admin.html'].includes(url)) {
   res.set('Cache-Control','no-store');
 }
 next();
});
app.use('/api/auth',require('./routes/auth'));
app.use('/api/invitations',require('./routes/invitations'));
app.use('/api/employee-credentials',require('./routes/employee-credentials').router);
app.get('/employee-password',require('./routes/employee-credentials').page);
app.use('/api/employee-enrollment',require('./routes/employee-enrollment').router);
app.get('/employee-enrollment',require('./routes/employee-enrollment').page);

app.use('/api/account/profile',require('./routes/profile').router);
app.use('/api/hrms',require('./routes/hrms').router);
app.use('/api/hrms/calendar',require('./routes/calendar').router);
app.get('/my-work',portalSession,require('./routes/hrms').page('employee'));
app.get('/hr',portalSession,require('./routes/hrms').page('management'));
app.get('/hr/access',portalSession,require('./routes/hrms').page('governance'));
app.get('/account/profile',portalSession,require('./routes/profile').page);
app.get('/account/security',portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','account-security.html'));});
app.use('/api/account/sessions',require('./routes/sessions'));
app.use('/api/notifications',require('./routes/notifications').router);
app.use('/api/project-reports',require('./routes/notifications').reports);
app.get('/notifications',portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','notifications.html'));});
app.get('/reports',portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','reports.html'));});
app.use('/api/projects/:projectId/delivery',require('./routes/delivery').router());
app.use('/api/search',require('./routes/search').router);
app.get('/search',portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','search.html'))});
app.use('/api/projects',require('./routes/projects').router);
app.get(['/projects','/projects/:id'],portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','projects.html'))});
app.use('/api/apps',require('./routes/apps'));
app.use('/api/sso',musicSso.router);
app.use('/api/workspaces',require('./routes/workspaces'));
app.use('/api/organizations',require('./routes/organizations').router);
// Internal VSPH employees, separate from customer organizations and products.
app.use('/api/employees',require('./routes/employees').router);
app.use('/api/employee-identity',require('./routes/employee-identity').router);
app.get('/employees/:id/account-link',portalSession,require('./routes/employee-identity').managerPage);
app.get('/employment',portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','employee-identity.html'))});
// Owner-only finance; never infer payment from an active subscription.
app.use('/api/finance/journal',require('./routes/finance-journal').router);
app.get('/admin/finance/journal',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','finance-journal.html'));});
app.use('/api/finance',require('./routes/finance').router);
app.get('/admin/finance',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','finance.html'));});
app.get(['/employees','/employees/','/employees/onboarding','/employees/onboarding/'],portalSession,require('./routes/employees').employeePage);
app.get('/organizations',portalSession,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','organizations.html'))});
app.use('/api/admin-management/product-registry',portalSession,requireAdmin,require('./routes/products').router);
app.get('/admin/products',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','products.html'))});
app.use('/api/admin-management/customers',portalSession,requireAdmin,require('./routes/customers').router);
app.get('/admin/customers',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','customers.html'))});
app.get('/admin/project-managers',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','project-managers.html'))});
app.use('/api/admin-management',portalSession,requireAdmin,require('./routes/admin-management'));
app.use('/api/admin-management/onboardings',portalSession,requireAdmin,require('./routes/onboarding').router);
app.get('/admin/provisioning',portalSession,requireAdmin,(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'views','provisioning.html'))});
app.get('/api/health',async(req,res)=>{
 if(!configured())return res.status(503).json({status:'not_configured',database:false,releaseReady:false,scope:'database-connectivity-only'});
 try{const{error}=await db().from('applications').select('id').limit(1);if(error)throw error;
 res.json({status:'ok',database:true,releaseReady:false,scope:'database-connectivity-only'});}catch(e){res.status(503).json({status:'database_unavailable',database:false,releaseReady:false,scope:'database-connectivity-only'})}
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
app.get('/fonts/inter-5a8d3e72.woff2',(req,res)=>{res.set('Cache-Control','public, max-age=31536000, immutable');res.sendFile(path.join(__dirname,'public','fonts','inter-5a8d3e72.woff2'),{cacheControl:false});});
app.use(express.static(path.join(__dirname,'public'),{index:false}));
app.use(safeError);
const port=Number(process.env.PORT||3000);
if(require.main===module)app.listen(port,()=>console.log(`VSPH Control Center → http://localhost:${port}`));
module.exports=app;

