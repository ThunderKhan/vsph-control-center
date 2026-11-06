const express=require('express'),path=require('node:path');
const {db,check}=require('../db'),{portalSession}=require('../security'),{uuid,rpcRoute}=require('../services/rpc'),{rateLimit}=require('../http-security');
const enrollment=require('../services/employee-enrollment');
const mail=require('../services/employee-invitation-email');
const router=express.Router();
router.use((req,res,next)=>{res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');next();});
function invalid(){const e=Error('Review and confirm the current employee enrollment fields.');e.validation=true;throw e;}
const version=x=>Number.isSafeInteger(x)&&x>0&&x<=2147483647;
function fields(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))invalid();}
const route=fn=>rpcRoute(async(req,res)=>{try{return await fn(req,res);}catch(e){if(e.enrollmentPassword)return res.status(400).json({code:'PASSWORD_REJECTED',message:e.message});if(e.enrollmentProvider)return res.status(503).json({code:'ENROLLMENT_RECOVERY_REQUIRED',message:e.message});if(['PGRST202','42883','42P01'].includes(e.code))return res.status(503).json({code:'SCHEMA_NOT_READY',message:'The reviewed employee enrollment migration must be installed before creating login invitations.'});throw e;}});
const managed=rateLimit({limit:20,windowMs:15*60*1000});
// Explicitly opt in to email. A private link remains available when delivery is
// absent or fails; a replay never reveals or resends a previously issued token.
function invitationMode(body){
 const mode=body.delivery===undefined?'manual':body.delivery;
 if(mode!=='manual'&&mode!=='email')invalid();
 return mode;
}
async function issueWithDelivery(req,res,options){
 const delivery=invitationMode(req.body);
 if(delivery==='email'&&!mail.isConfigured()){
  res.status(503);
  return {code:'EMAIL_NOT_CONFIGURED',message:'Employee invitation email is not configured. Select private link delivery or configure an approved email webhook.'};
 }
 const issued=await enrollment.issue({client:db(),actor:req.user.id,sessionHash:req.portalSession.token_hash,origin:process.env.PUBLIC_ORIGIN||'http://localhost:3000',...options});
 if(delivery==='manual'||!issued.url)return issued;
 const submitted=await mail.submit({to:issued.recipientEmail,inviteUrl:issued.url});
 return {...issued,delivery:submitted?'email_submitted':'private_manual_handoff',
  emailDelivery:{status:submitted?'submitted':'failed',message:submitted?
   'The email provider accepted this invitation request; mailbox delivery is not confirmed. You may copy the private link as a backup.':
   'The invitation was created but the email provider did not accept it. Copy the private link or explicitly reissue later.'}};
}

// Email readiness never exposes a provider URL, token, or any employee data.
router.get('/delivery',portalSession,route(async req=>{
 if(Object.keys(req.query).length)invalid();
 check(await db().rpc('internal_employee_command',{p_actor:req.user.id,p_action:'access',p_id:null,p_data:{}}));
 return {emailConfigured:mail.isConfigured()};
}));
router.get('/employees/:id',portalSession,route(async req=>{
 if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();
 const review=await enrollment.command(db(),req.user.id,'review',req.params.id,{currentHash:req.portalSession.token_hash});
 return {...review,emailDeliveryAvailable:mail.isConfigured()};
}));
router.post('/employees/:id',portalSession,managed,route((req,res)=>{
 fields(req.body,['rosterVersion','confirmed','delivery']);const key=req.get('Idempotency-Key');if(!uuid(req.params.id)||!uuid(key)||!version(req.body.rosterVersion)||req.body.confirmed!==true)invalid();
 return issueWithDelivery(req,res,{employeeId:req.params.id,rosterVersion:req.body.rosterVersion,key});
}));
for(const action of ['renew','cancel'])router.post('/:id/'+action,portalSession,managed,route((req,res)=>{
 fields(req.body,['rosterVersion','version','confirmed',...(action==='renew'?['delivery']:[])]);if(!uuid(req.params.id)||!version(req.body.rosterVersion)||!version(req.body.version)||req.body.confirmed!==true)invalid();
 if(action==='renew')return issueWithDelivery(req,res,{enrollmentId:req.params.id,version:req.body.version,rosterVersion:req.body.rosterVersion});
 return enrollment.command(db(),req.user.id,'cancel',req.params.id,{...req.body,currentHash:req.portalSession.token_hash});
}));
const publicLimit=rateLimit({limit:20,windowMs:15*60*1000});
function proof(body,accept=false){fields(body,accept?['id','token','password','confirmed']:['id','token']);if(!uuid(body.id)||typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))invalid();if(accept&&(body.confirmed!==true||typeof body.password!=='string'||body.password.length<8||body.password.length>128))invalid();return body;}
router.post('/inspect',publicLimit,route(req=>{const b=proof(req.body);return enrollment.command(db(),null,'inspect',b.id,{tokenHash:enrollment.hash(b.token)});}));
router.post('/accept',publicLimit,route(req=>{const b=proof(req.body,true);return enrollment.accept({client:db(),...b});}));
function page(req,res){res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').sendFile(path.join(__dirname,'..','views','employee-enrollment.html'));}
module.exports={router,page,proof,invitationMode};
