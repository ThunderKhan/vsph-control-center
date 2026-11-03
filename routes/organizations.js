const express = require('express');
const {db, check} = require('../db');
const {portalSession} = require('../security');
const {uuid, rpcRoute} = require('../services/rpc');
function validate(action, data) {
 const fields={profile:['version','name'],member:['userId','version','role','status','confirmed'],role:['userId','version','applicationId','role','confirmed']};
 if(!data||Array.isArray(data)||!fields[action]||Object.keys(data).some(k=>!fields[action].includes(k))||!Number.isSafeInteger(data.version)||data.version<1)throw Error('Invalid organization update.');
 if(action==='profile'){
  if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>150||/[\u0000-\u001f\u007f]/.test(data.name))throw Error('Provide a valid organization name.');
 }else{
  if(!uuid(data.userId)||data.confirmed!==true)throw Error('Review and confirm this access change.');
  if(action==='member'&&(!['admin','member','viewer'].includes(data.role)||!['active','suspended'].includes(data.status)))throw Error('Invalid membership state.');
  if(action==='role'&&(!uuid(data.applicationId)||!['','admin','manager','user','viewer','staff','musician'].includes(data.role)))throw Error('Invalid product role.');
 }
 return data;
}
const router=express.Router();router.use(portalSession);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const command=(req,action,id,data={})=>db().rpc('organization_command',{p_actor:req.user.id,p_action:action,p_id:id,p_data:data}).then(check);
router.get('/',rpcRoute(req=>{
 if(req.query.afterId&&!uuid(req.query.afterId)){const e=Error('Invalid cursor.');e.validation=true;throw e;}
 return command(req,'list',null,req.query.afterId?{afterId:req.query.afterId}:{});
}));
router.use('/:id',(req,res,next)=>{if(!uuid(req.params.id))return res.status(400).json({message:'Invalid organization.'});next();});
router.get('/:id',rpcRoute(req=>command(req,'read',req.params.id)));
router.get('/:id/members',rpcRoute(req=>{
 if(req.query.afterId&&!uuid(req.query.afterId)){const e=Error('Invalid cursor.');e.validation=true;throw e;}
 return command(req,'members',req.params.id,req.query.afterId?{afterId:req.query.afterId}:{});
}));
for(const action of ['profile','member','role'])router.post('/:id/'+action,rpcRoute(req=>{
 let data;try{data=validate(action,req.body);}catch(e){e.validation=true;throw e;}
 return command(req,action,req.params.id,data);
}));
module.exports={router,validate};
const {validateInvite}=require('./customers');
function validateInvitation(body,organizationId){
 const request=validateInvite(body,organizationId);
 if(/[\u0000-\u001f\u007f]/.test(request.adminName)||request.products.some(p=>p.role==='super_admin'))throw Error('Invalid delegated invitation roles or name.');
 return {...request,delegated:true};
}
const invitation=(req,action,data={})=>db().rpc('organization_invitation',{p_actor:req.user.id,p_action:action,p_id:req.params.id,p_data:data}).then(check);
router.get('/:id/invitations',rpcRoute(req=>invitation(req,'list')));
router.post('/:id/invitations',rpcRoute(async(req,res)=>{
 let request;try{request=validateInvitation(req.body,req.params.id);}catch(e){e.validation=true;throw e;}
 const key=req.get('Idempotency-Key');if(!uuid(key))return res.status(400).json({message:'A UUID Idempotency-Key is required.'});
 const result=await invitation(req,'queue',{key,request});res.status(202);return {...result,message:'Invitation queued. Delivery is not confirmed.'};
}));
for(const action of ['cancel','reissue'])router.post('/:id/invitations/:invitationId/'+action,rpcRoute(req=>{
 if(!uuid(req.params.invitationId)||!Number.isSafeInteger(req.body?.generation)||req.body.generation<1||req.body.confirmed!==true||Object.keys(req.body).some(k=>!['generation','confirmed'].includes(k))){const e=Error('Review and confirm the current invitation generation.');e.validation=true;throw e;}
 return invitation(req,action,{invitationId:req.params.invitationId,generation:req.body.generation,confirmed:true});
}));
module.exports.validateInvitation=validateInvitation;
