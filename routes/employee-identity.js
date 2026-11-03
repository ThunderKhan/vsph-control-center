const express=require('express'),path=require('node:path');
const {db,check}=require('../db'),{portalSession}=require('../security');
const {uuid,rpcRoute}=require('../services/rpc'),{rateLimit}=require('../http-security');
const {verifyIdentity,identityFailure}=require('../services/verify-identity');
function invalid(){const e=Error('Review and confirm the current employee account-link state.');e.validation=true;throw e;}
const version=value=>Number.isInteger(value)&&value>0&&value<=2147483647;
function validate(action,body){
 const fields={request:['rosterVersion','confirmed'],renew:['rosterVersion','requestId','requestVersion','confirmed'],cancel:['rosterVersion','requestId','requestVersion','confirmed'],revoke:['rosterVersion','linkVersion','confirmed'],accept:['rosterVersion','requestVersion','confirmed','password','totpCode','totpFactorId']}[action];
 if(!fields||!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!fields.includes(k))||!version(body.rosterVersion)||body.confirmed!==true)invalid();
 for(const key of ['requestVersion','linkVersion'])if(fields.includes(key)&&!version(body[key]))invalid();
 if(fields.includes('requestId')&&!uuid(body.requestId))invalid();
 if(action==='accept'&&(typeof body.password!=='string'||!body.password||body.password.length>4096||(body.totpCode!==undefined&&(typeof body.totpCode!=='string'||(body.totpCode!==''&&!/^\d{6}$/.test(body.totpCode))))||(body.totpFactorId!==undefined&&!uuid(body.totpFactorId))))invalid();
 return body;
}
const command=(req,action,id=null,data={})=>db().rpc('internal_employee_identity',{p_actor:req.user.id,p_action:action,p_id:id,p_data:{...data,currentHash:req.portalSession.token_hash}}).then(check);
const router=express.Router();router.use(portalSession,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/mine',rpcRoute(req=>{if(Object.keys(req.query).length)invalid();return command(req,'inbox');}));
router.get('/employees/:id',rpcRoute(req=>{if(!uuid(req.params.id)||Object.keys(req.query).length)invalid();return command(req,'manage',req.params.id);}));
for(const action of ['request','renew','cancel','revoke'])router.post('/employees/:id/'+action,rpcRoute(req=>{
 if(!uuid(req.params.id))invalid();const data=validate(action,req.body);
 if(action==='request'){const key=req.get('Idempotency-Key');if(!uuid(key))invalid();return command(req,action,req.params.id,{...data,key});}
 return command(req,action,req.params.id,data);
}));
router.post('/requests/:id/accept',rateLimit({limit:10,windowMs:15*60*1000}),rpcRoute(async(req,res)=>{
 if(!uuid(req.params.id))invalid();const input=validate('accept',req.body);
 // Preflight eligibility before contacting Auth. Repeat authority/session/version
 // checks under SQL locks after verification; no provider tokens reach the UI.
 const inbox=await command(req,'inbox');const invitation=inbox.requests.find(r=>r.id===req.params.id);
 if(!invitation){const e=Error('Request unavailable.');e.code='42501';throw e;}
 if(invitation.version!==input.requestVersion||invitation.roster_version!==input.rosterVersion||invitation.current_roster_version!==input.rosterVersion){const e=Error('Request changed.');e.code='40001';throw e;}
 let verified;
 try{verified=await verifyIdentity({email:req.user.email,password:input.password,totpCode:input.totpCode,totpFactorId:input.totpFactorId},{expectedUserId:req.user.id});}
 catch(error){if(identityFailure(error,res))return;throw error;}
 return command(req,'accept',req.params.id,{rosterVersion:input.rosterVersion,requestVersion:input.requestVersion,confirmed:true,assurance:verified.assurance,verifiedAt:new Date().toISOString()});
}));
async function managerPage(req,res,next){try{if(!uuid(req.params.id))invalid();await command(req,'manage',req.params.id);res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'..','views','employee-identity.html'));}catch(e){if(e.code==='42501')return res.status(403).send('Current workforce permission is required.');if(e.validation)return res.status(400).send(e.message);next(e);}}
module.exports={router,validate,managerPage};
