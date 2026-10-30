require('dotenv').config();
const express=require('express');const path=require('node:path');const cookieParser=require('cookie-parser');
const {db,configured}=require('./db');
const {portalSession,optionalPortal,requireAdmin,requireApp,validateOrigin,getApp,getContexts}=require('./security');
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
// All applications use this login view by default. Explicit, reviewed overrides
// can be placed here later for a customer's structural requirements.
const sharedAuthView = path.join(__dirname,'views','auth.html');
const authViews = Object.freeze({
  // CRM: path.join(__dirname,'views','crm-special-login.html')
});
app.use(express.json({limit:'100kb'}));app.use(express.urlencoded({extended:false}));app.use(cookieParser());
app.use(validateOrigin);
// Authenticated HTML and session-dependent API responses must not be stored by
// browser/proxy caches; navigating Back after logout should trigger a fresh check.
app.use((req,res,next)=>{
 const url=String(req.originalUrl||'').split('?')[0];
 if(url.startsWith('/api/auth/') || url==='/api/apps' || url.startsWith('/api/apps/') ||
    url.startsWith('/apps/') || ['/', '/login', '/login.html', '/index.html',
    '/dashboard','/applications','/admin','/dashboard.html','/applications.html','/admin.html'].includes(url)) {
   res.set('Cache-Control','no-store');
 }
 next();
});
app.use('/api/auth',require('./routes/auth'));
app.use('/api/apps',require('./routes/apps'));
app.use('/api/workspaces',require('./routes/workspaces'));
app.use('/api/admin-management',portalSession,requireAdmin,require('./routes/admin-management'));
app.get('/api/health',async(req,res)=>{
 if(!configured())return res.status(503).json({status:'not_configured',database:false});
 try{const{error}=await db().from('applications').select('id').limit(1);if(error)throw error;
 res.json({status:'ok',database:true});}catch(e){res.status(503).json({status:'database_unavailable',database:false})}
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
app.use((err,req,res,next)=>{console.error('Request error:',err.message);if(res.headersSent)return next(err);
 res.status(500).json({message:'Server error. Check configuration and server logs.'});});
const port=Number(process.env.PORT||3000);
if(require.main===module)app.listen(port,()=>console.log(`VSPH Control Center → http://localhost:${port}`));
module.exports=app;
