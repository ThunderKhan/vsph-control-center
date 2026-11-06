const express=require('express'),path=require('node:path');
const {db}=require('../db'),{portalSession}=require('../security'),{uuid,rpcRoute}=require('../services/rpc'),{rateLimit}=require('../http-security');
const enrollment=require('../services/employee-enrollment');
const router=express.Router();
router.use((req,res,next)=>{res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');next();});
function invalid(){const e=Error('Review and confirm the current employee enrollment fields.');e.validation=true;throw e;}
const version=x=>Number.isSafeInteger(x)&&x>0&&x<=2147483647;
function fields(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))invalid();}
const route=fn=>rpcRoute(async(req,res)=>{try{return await fn(req,res);}catch(e){if(e.enrollmentPassword)return res.status(400).json({code:'PASSWORD_REJECTED',message:e.message});if(e.enrollmentProvider)return res.status(503).json({code:'ENROLLMENT_RECOVERY_REQUIRED',message:e.message});if(['PGRST202','42883','42P01'].includes(e.code))return res.status(503).json({code:'SCHEMA_NOT_READY',message:'The reviewed employee enrollment migration must be installed before creating login invitations.'});throw e;}});
const managed=rateLimit({limit:20,windowMs:15*60*1000});
router.get('/employees/:id',portalSession,route(req=>{if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();return enrollment.command(db(),req.user.id,'review',req.params.id,{currentHash:req.portalSession.token_hash});}));
router.post('/employees/:id',portalSession,managed,route(req=>{
 fields(req.body,['rosterVersion','confirmed']);const key=req.get('Idempotency-Key');if(!uuid(req.params.id)||!uuid(key)||!version(req.body.rosterVersion)||req.body.confirmed!==true)invalid();
 return enrollment.issue({client:db(),actor:req.user.id,sessionHash:req.portalSession.token_hash,employeeId:req.params.id,rosterVersion:req.body.rosterVersion,key,origin:process.env.PUBLIC_ORIGIN||'http://localhost:3000'});
}));
for(const action of ['renew','cancel'])router.post('/:id/'+action,portalSession,managed,route(req=>{
 fields(req.body,['rosterVersion','version','confirmed']);if(!uuid(req.params.id)||!version(req.body.rosterVersion)||!version(req.body.version)||req.body.confirmed!==true)invalid();
 if(action==='renew')return enrollment.issue({client:db(),actor:req.user.id,sessionHash:req.portalSession.token_hash,enrollmentId:req.params.id,version:req.body.version,rosterVersion:req.body.rosterVersion,origin:process.env.PUBLIC_ORIGIN||'http://localhost:3000'});
 return enrollment.command(db(),req.user.id,'cancel',req.params.id,{...req.body,currentHash:req.portalSession.token_hash});
}));
const publicLimit=rateLimit({limit:20,windowMs:15*60*1000});
function proof(body,accept=false){fields(body,accept?['id','token','password','confirmed']:['id','token']);if(!uuid(body.id)||typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))invalid();if(accept&&(body.confirmed!==true||typeof body.password!=='string'||body.password.length<12||body.password.length>128))invalid();return body;}
router.post('/inspect',publicLimit,route(req=>{const b=proof(req.body);return enrollment.command(db(),null,'inspect',b.id,{tokenHash:enrollment.hash(b.token)});}));
router.post('/accept',publicLimit,route(req=>{const b=proof(req.body,true);return enrollment.accept({client:db(),...b});}));
function page(req,res){res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').sendFile(path.join(__dirname,'..','views','employee-enrollment.html'));}
module.exports={router,page,proof};
