const express=require('express'),path=require('node:path'),{db}=require('../db'),{portalSession}=require('../security'),{hashToken}=require('../tokens'),{uuid,rpcRoute}=require('../services/rpc'),{rateLimit}=require('../http-security');
const credentials=require('../services/employee-credentials');
const router=express.Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');next();});
const route=fn=>rpcRoute(async(req,res)=>{try{return await fn(req,res);}catch(e){if(e.credentialStepUp)return res.status(401).json({code:'IDENTITY_STEP_UP_REQUIRED',message:e.message});if(e.code==='22023'&&req.path==='/replace')return res.status(400).json({code:'PASSWORD_REJECTED',message:'Choose a different valid personal password.'});if(e.enrollmentPassword)return res.status(400).json({code:'PASSWORD_REJECTED',message:e.message});if(e.enrollmentProvider)return res.status(503).json({code:'CREDENTIAL_RECOVERY_REQUIRED',message:e.message});if(['42883','PGRST202','42P01'].includes(e.code))return res.status(503).json({code:'SCHEMA_NOT_READY',message:'The employee temporary-credentials migration must be installed.'});throw e;}});
function invalid(){const e=Error('Confirm the current employee credentials fields.');e.validation=true;throw e;}
const version=x=>Number.isSafeInteger(x)&&x>0&&x<=2147483647;
router.get('/employees/:id',portalSession,route(req=>{if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();return credentials.command(db(),req.user.id,'review',req.params.id,{currentHash:req.portalSession.token_hash});}));
router.post('/employees/:id',portalSession,rateLimit({limit:20,windowMs:900000}),route(req=>{
 const b=req.body,key=req.get('Idempotency-Key');if(!uuid(req.params.id)||!uuid(key)||!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['rosterVersion','credentialVersion','enrollmentVersion','confirmed'].includes(k))||!version(b.rosterVersion)||b.confirmed!==true||['credentialVersion','enrollmentVersion'].some(k=>b[k]!==undefined&&!version(b[k])))invalid();
 return credentials.createTemporary({client:db(),actor:req.user.id,sessionHash:req.portalSession.token_hash,employeeId:req.params.id,...b,key,origin:process.env.PUBLIC_ORIGIN||'http://localhost:3000'});
}));
router.get('/status',route(req=>{if(Object.keys(req.query).length)invalid();return credentials.command(db(),null,'status',null,{setupHash:hashToken(req.cookies?.[credentials.COOKIE])});}));
router.post('/replace',rateLimit({limit:10,windowMs:900000}),route(async(req,res)=>{
 const b=req.body;if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['password','confirmed'].includes(k))||b.confirmed!==true||typeof b.password!=='string'||b.password.length<12||b.password.length>128)invalid();
 const result=await credentials.replacePassword({client:db(),setupHash:hashToken(req.cookies?.[credentials.COOKIE]),password:b.password});res.clearCookie(credentials.COOKIE,{path:'/api/employee-credentials',sameSite:'lax',secure:process.env.NODE_ENV==='production'});return result;
}));
function page(req,res){res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').sendFile(path.join(__dirname,'..','views','employee-password.html'));}
module.exports={router,page};
