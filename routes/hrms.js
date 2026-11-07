const express=require('express'),path=require('node:path');
const {portalSession}=require('../security'),{db,check}=require('../db'),{uuid,rpcRoute}=require('../services/rpc');
const router=express.Router();router.use(portalSession,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
function invalid(){const e=Error('Review the current HR record and required fields.');e.validation=true;throw e;}
function fields(body,keys){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==keys.length||Object.keys(body).some(k=>!keys.includes(k)))invalid();return body;}
function validate(action,body){
 const keys={task:['version','status'],leave:['startOn','endOn','kind','reason'],cancel:['version'],in:[],out:['version'],review:['version','decision','note','confirmed'],incomplete:['version','note','confirmed']}[action];
 if(!keys)invalid();fields(body,keys);
 if(keys.includes('version')&&(!Number.isInteger(body.version)||body.version<1||body.version>2147483646))invalid();
 if(keys.includes('confirmed')&&body.confirmed!==true)invalid();
 if(keys.includes('note')&&(typeof body.note!=='string'||body.note.length>300||(action==='incomplete'&&body.note.trim().length<8)))invalid();
 if(action==='task'&&!['in_progress','in_review','done','blocked'].includes(body.status))invalid();
 if(action==='review'&&!['approved','rejected'].includes(body.decision))invalid();
 if(action==='leave'){
  for(const key of ['startOn','endOn'])if(typeof body[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body[key])||!Number.isFinite(Date.parse(body[key]))||new Date(body[key]).toISOString().slice(0,10)!==body[key])invalid();
  if(body.endOn<body.startOn||Date.parse(body.endOn)-Date.parse(body.startOn)>365*86400000||!['annual','sick','unpaid','other'].includes(body.kind)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500)invalid();
 }
 return body;
}
const call=(req,rpc,action,id=null,data={})=>db().rpc(rpc,{p_actor:req.user.id,p_action:action,p_id:id,p_data:{...data,currentHash:req.portalSession.token_hash}}).then(check);
const access=req=>call(req,'hrms_access','get');
router.get('/access',rpcRoute(req=>{if(Object.keys(req.query).length)invalid();return access(req);}));
router.get('/me',rpcRoute(req=>{if(Object.keys(req.query).some(k=>k!=='afterTaskId')||(req.query.afterTaskId&&!uuid(req.query.afterTaskId)))invalid();return call(req,'internal_self_service','get',null,req.query);}));
router.get('/me/activity',rpcRoute(req=>{
 if(Object.keys(req.query).length)invalid();
 return db().rpc('internal_work_activity',{
  p_actor:req.user.id,p_session_hash:req.portalSession.token_hash
 }).then(check);
}));
for(const [url,action,validation,hasId,key] of [
 ['/me/tasks/:id/status','task.status','task',true,false],['/me/leave','leave.request','leave',false,true],['/me/leave/:id/cancel','leave.cancel','cancel',true,false],['/me/attendance/in','attendance.in','in',false,true],['/me/attendance/:id/out','attendance.out','out',true,true],
 ['/leave/:id/review','leave.review','review',true,false],['/attendance/:id/incomplete','attendance.incomplete','incomplete',true,false]
])router.post(url,rpcRoute(req=>{
 if(Object.keys(req.query).length||(hasId&&!uuid(req.params.id)))invalid();const data=validate(validation,req.body);
 const retryKey=key?req.get('Idempotency-Key'):null;if(key&&!uuid(retryKey))invalid();
 return call(req,url.startsWith('/me/')?'internal_self_service':'internal_hrms',action,hasId?req.params.id:retryKey,{...data,...(action==='attendance.out'?{key:retryKey}:{})});
}));
for(const type of ['leave','attendance'])router.get('/'+type,rpcRoute(req=>{
 if(Object.keys(req.query).some(k=>!['afterId',...(type==='leave'?['status']:[])].includes(k))||(req.query.afterId&&!uuid(req.query.afterId))||(req.query.status&&!['all','pending','approved','rejected','cancelled'].includes(req.query.status)))invalid();
 return call(req,'internal_hrms',type+'.list',null,req.query);
}));
function page(kind){return async(req,res,next)=>{try{const flags=await access(req);if(!flags[kind==='employee'?'employee':kind==='governance'?'governHr':'management'])return res.status(403).send('Current internal workforce permission is required.');res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'..','views',kind==='employee'?'my-work.html':kind==='governance'?'hr-access.html':'hr-workspace.html'));}catch(e){if(e.code==='42501')return res.status(403).send('Current internal workforce permission is required.');next(e);}};}
module.exports={router,validate,page,access};
