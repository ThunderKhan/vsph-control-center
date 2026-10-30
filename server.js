require('dotenv').config();
const express=require('express');const path=require('node:path');const cookieParser=require('cookie-parser');
const {db,configured}=require('./db');
const {portalSession,requireAdmin,requireApp,validateOrigin,getApp,getContexts}=require('./security');
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
app.use(express.json({limit:'100kb'}));app.use(express.urlencoded({extended:false}));app.use(cookieParser());
app.use(validateOrigin);
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
 res.sendFile(path.join(__dirname,'public','app-login.html'));
 }catch(e){next(e)}
});
app.get('/apps/:app/home',portalSession,requireApp,(req,res)=>res.sendFile(path.join(__dirname,'public','app-home.html')));
// Login, dashboard, and admin pages are served explicitly; protected pages cannot be bypassed by static hosting.
app.get('/dashboard.html',portalSession,(req,res)=>res.sendFile(path.join(__dirname,'public','dashboard.html')));
app.get('/admin.html',portalSession,requireAdmin,(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.use((req,res,next)=>['/app-home.html','/app-login.html'].includes(req.path)?res.status(404).send('Not found.'):next());
app.use(express.static(path.join(__dirname,'public'),{index:false}));
app.get('/',(req,res)=>res.redirect(302,'/login.html'));
app.use((err,req,res,next)=>{console.error('Request error:',err.message);if(res.headersSent)return next(err);
 res.status(500).json({message:'Server error. Check configuration and server logs.'});});
const port=Number(process.env.PORT||3000);
if(require.main===module)app.listen(port,()=>console.log(`VSPH Control Center → http://localhost:${port}`));
module.exports=app;
