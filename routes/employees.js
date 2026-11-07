const express = require('express');
const path = require('node:path');
const {db,check} = require('../db');
const {portalSession} = require('../security');
const {reviewHrAccess}=require('../services/employee-hr-readiness');
const {canonicalDepartment}=require('../services/employee-departments');
const {rpcRoute,uuid} = require('../services/rpc');
const {rateLimit} = require('../http-security');

const router=express.Router();
router.use(portalSession);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const allowedTypes=new Set(['full_time','part_time','intern','contract']);
const allowedStatuses=new Set(['onboarding','active','on_leave','inactive']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const control=/[\u0000-\u001f\u007f]/;
function invalid(message){const error=Error(message);error.validation=true;throw error;}
function textField(value,max,label){
 if(typeof value!=='string'||!value.trim()||value.trim().length>max||control.test(value))
  invalid('Provide a valid '+label+'.');
 return value.trim();
}
function dateField(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||
    new Date(value).toISOString().slice(0,10)!==value)invalid('Provide a valid ISO start date.');
 return value;
}
function employeeFields(body,{update=false}={}){
 if(!body||typeof body!=='object'||Array.isArray(body))invalid('Invalid employee form.');
 const allowed=['fullName',...(!update?['email']:[]),'department','jobTitle','employmentType','startDate',...(update?['version','status','confirmed']:[])];
 if(Object.keys(body).length!==allowed.length||Object.keys(body).some(k=>!allowed.includes(k)))
   invalid('Only the documented employee fields are allowed.');
 const fields={
  fullName:textField(body.fullName,150,'employee name'),
  department:textField(body.department,100,'department'),
  jobTitle:textField(body.jobTitle,120,'job title'),
  employmentType:body.employmentType,
  startDate:dateField(body.startDate)
 };
 fields.department=canonicalDepartment(fields.department);
 if(!fields.department)invalid('Choose a department from the approved list.');
 if(!allowedTypes.has(fields.employmentType))invalid('Choose a supported employment type.');
 if(update){
  if(!Number.isSafeInteger(body.version)||body.version<1||body.version>2147483647||!allowedStatuses.has(body.status)||body.confirmed!==true)
    invalid('Reload and confirm the current employee status and version.');
  return {...fields,status:body.status,version:body.version,confirmed:true};
 }
 const email=textField(body.email,190,'work email').toLowerCase();
 if(!emailPattern.test(email))invalid('Provide a valid employee work email.');
 return {...fields,email};
}
function roleFields(body){
 if(!body||Array.isArray(body)||Object.keys(body).length!==2||Object.keys(body).some(k=>!['version','confirmed'].includes(k))||
   !Number.isSafeInteger(body.version)||body.version<1||body.version>2147483647||body.confirmed!==true)
  invalid('Confirm the current employee version before changing HR authority.');
 return {version:body.version,confirmed:true};
}
function command(req,action,id=null,data={}) {
 return db().rpc('internal_employee_command',{p_actor:req.user.id,p_action:action,p_id:id,p_data:data}).then(check);
}
router.get('/access',rpcRoute(req=>command(req,'access')));
// Removal is a separate, audited workforce operation; ordinary HR cannot inspect owner history.
router.get('/removals',rpcRoute(req=>{
 if(Object.keys(req.query).length)invalid('Invalid removal-history filters.');
 return db().rpc('internal_employee_removal',{p_actor:req.user.id,p_action:'history',p_id:null,p_data:{}}).then(check);
}));
router.post('/:id/remove',rateLimit({limit:12,windowMs:15*60*1000}),rpcRoute(req=>{
 if(!uuid(req.params.id))invalid('Invalid employee identifier.');
 const body=req.body;
 if(!body||Array.isArray(body)||typeof body!=='object'||
    Object.keys(body).length!==3||Object.keys(body).some(k=>!['version','reason','confirmed'].includes(k))||
    !Number.isInteger(body.version)||body.version<1||body.version>2147483647||
    body.confirmed!==true||typeof body.reason!=='string'||body.reason.trim().length<8||
    body.reason.trim().length>500||control.test(body.reason))
  invalid('Confirm the current employee version and provide a removal reason (8–500 characters).');
 return db().rpc('internal_employee_removal',{p_actor:req.user.id,p_action:'remove',p_id:req.params.id,
  p_data:{version:body.version,reason:body.reason.trim(),confirmed:true}}).then(check);
}));
router.get('/',rpcRoute(req=>{
 const keys=Object.keys(req.query);
 if(keys.some(k=>!['afterId','status','search'].includes(k))||
    (req.query.afterId&&!uuid(req.query.afterId))||
    (req.query.status&&!['all',...allowedStatuses].includes(req.query.status))||
    (req.query.search&&(typeof req.query.search!=='string'||req.query.search.length>80)))
  invalid('Invalid employee directory filters.');
 return command(req,'list',null,{
  ...(req.query.afterId?{afterId:req.query.afterId}:{}),
  ...(req.query.status?{status:req.query.status}:{}),
  ...(req.query.search?{search:req.query.search}:{}),
 });
}));
router.post('/',rpcRoute(async(req,res)=>{
 const data=employeeFields(req.body);
 const key=req.get('Idempotency-Key');
 if(!uuid(key))invalid('A UUID Idempotency-Key is required to safely create employees.');
 let result;
 try{result=await command(req,'create',key,data);}
 catch(cause){
  if(cause.code!=='23505')throw cause;
  // SQL enforces unique work emails. Identify this specific conflict through
  // the authorized workforce command; never silently reuse an identity.
  const directory=await command(req,'list',null,{search:data.email});
  const existing=directory.employees?.find(employee=>employee.email===data.email);
  if(!existing)throw cause;
  res.status(409);
  return {code:'EMPLOYEE_EXISTS',employeeId:existing.id,
   message:'This work email already belongs to an employee. Review that record and continue account setup instead of creating a duplicate.'};
 }
 res.status(result.replayed?200:201);
 return {...result,message:'Employee roster onboarding saved. No login account or email invitation was created.'};
}));
router.post('/:id/update',rpcRoute(req=>{
 if(!uuid(req.params.id))invalid('Invalid employee identifier.');
 return command(req,'update',req.params.id,employeeFields(req.body,{update:true}));
}));
for(const action of ['grant_hr','revoke_hr']){
 router.post('/:id/'+action,rpcRoute(async req=>{
  if(!uuid(req.params.id))invalid('Invalid employee identifier.');
  const fields=roleFields(req.body);
  // Fail closed on an older target: no fallback to the historical email-only
  // HR grant RPC when consent/schema is missing. Revocation stays available.
  if(action==='grant_hr'){
   const readiness=await reviewHrAccess(db(),req);
   if(readiness.rosterVersion!==fields.version){const error=Error('Roster changed.');error.code='40001';throw error;}
   if(!readiness.canGrant)invalid(readiness.message);
   return db().rpc('internal_employee_identity',{p_actor:req.user.id,p_action:'grant_hr',p_id:req.params.id,p_data:{rosterVersion:fields.version,confirmed:true,currentHash:req.portalSession.token_hash}}).then(check);
  }
  return command(req,action,req.params.id,fields);
 }));
}
// Server-side page guard: sharing a URL does not expose the HR interface to other users.
async function employeePage(req,res,next){
 try{
  check(await db().rpc('internal_employee_command',{p_actor:req.user.id,p_action:'access',p_id:null,p_data:{}}));
  res.set('Cache-Control','no-store');
  res.sendFile(path.join(__dirname,'..','views',/\/onboarding\/?$/.test(req.path)?'employee-onboarding.html':'employees.html'));
 }catch(error){
  if(error.code==='42501')return res.status(403).send('VSPH employee management requires owner or HR permission.');
  next(error);
 }
}
module.exports={router,employeePage,employeeFields,roleFields};
