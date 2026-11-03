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
