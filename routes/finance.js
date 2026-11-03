const express=require('express');
const {db,check}=require('../db');
const {portalSession,requireAdmin}=require('../security');
const {rpcRoute,uuid}=require('../services/rpc');
const router=express.Router();
router.use(portalSession,requireAdmin);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});

function invalid(message){const e=Error(message);e.validation=true;throw e;}
function keys(body,allowed){
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).length!==allowed.length||Object.keys(body).some(k=>!allowed.includes(k)))
   invalid('Invalid finance fields.');
}
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const cents=n=>Number.isSafeInteger(n)&&n>0&&n<=1000000000000;
function validate(action,body){
 if(action==='invoice.create'){
  keys(body,['reference','organizationId','projectId','amountPaise','issuedOn','dueOn']);
  if(typeof body.reference!=='string'||!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,79}$/.test(body.reference)||
   !uuid(body.organizationId)||!(body.projectId===null||uuid(body.projectId))||
   !cents(body.amountPaise)||!iso(body.issuedOn)||!iso(body.dueOn)||body.dueOn<body.issuedOn)
   invalid('Provide a valid customer, invoice reference, amount in paise and dates.');
  return body;
 }
 if(action==='payment.record'){
  keys(body,['idempotencyKey','reference','amountPaise','receivedOn']);
  if(!uuid(body.idempotencyKey)||typeof body.reference!=='string'||
   !/^[A-Za-z0-9][A-Za-z0-9/_-]{2,99}$/.test(body.reference)||
   !cents(body.amountPaise)||!iso(body.receivedOn)||
   body.receivedOn>new Date().toISOString().slice(0,10))
   invalid('Provide a valid, nonfuture INR payment amount, reference and receipt date.');
  return body;
 }
 if(action==='invoice.void'){
  keys(body,['version','reason','confirmed']);
  if(!Number.isSafeInteger(body.version)||body.version<1||body.version>999999999||
    body.confirmed!==true||typeof body.reason!=='string'||
    body.reason.trim().length<8||body.reason.trim().length>300)
    invalid('Confirm the invoice version and a reason (8–300 characters).');
  return body;
 }
 if(action==='payment.reverse'){
  keys(body,['reason','confirmed']);
  if(body.confirmed!==true||typeof body.reason!=='string'||
   body.reason.trim().length<8||body.reason.trim().length>300)
   invalid('Confirm the receipt reversal and a reason (8–300 characters).');
  return body;
 }
 invalid('Unknown finance action.');
}
const command=(req,action,id=null,data={})=>db().rpc('finance_command',{
 p_actor:req.user.id,p_action:action,p_id:id,p_data:data
}).then(check);
router.get('/',rpcRoute(req=>db().rpc('finance_report',{p_actor:req.user.id,p_action:'dashboard',p_id:null,p_data:{}}).then(check)));
router.get('/options',rpcRoute(async(req)=>{
 const [orgs,projects]=await Promise.all([
   db().from('organizations').select('id,name').eq('status','active').order('name').limit(251),
   db().from('projects').select('id,name,customer_organization_id').eq('kind','customer').order('name').limit(251)
 ]);
 const organizations=check(orgs),customerProjects=check(projects);
 if(organizations.length>250||customerProjects.length>250)
  invalid('Finance lookup exceeds supported size. Contact the platform administrator.');
 return {organizations,projects:customerProjects};
}));
router.post('/invoices',rpcRoute(async(req,res)=>{
 const key=req.get('Idempotency-Key');
 if(!uuid(key))invalid('A UUID Idempotency-Key is required.');
 const data=validate('invoice.create',req.body);
 const result=await command(req,'invoice.create',key,data);
 res.status(result.replayed?200:201);
 return result;
}));
router.post('/invoices/:id/payments',rpcRoute(async(req,res)=>{
 if(!uuid(req.params.id))invalid('Invalid invoice ID.');
 const data=validate('payment.record',req.body);
 const result=await command(req,'payment.record',req.params.id,data);
 res.status(result.replayed?200:201);
 return result;
}));
router.post('/payments/:id/reverse',rpcRoute(req=>{
 if(!uuid(req.params.id))invalid('Invalid payment ID.');
 return command(req,'payment.reverse',req.params.id,validate('payment.reverse',req.body));
}));
router.post('/invoices/:id/void',rpcRoute(req=>{
 if(!uuid(req.params.id))invalid('Invalid invoice ID.');
 return command(req,'invoice.void',req.params.id,validate('invoice.void',req.body));
}));
module.exports={router,validate};
