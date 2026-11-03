const express=require('express');
const {db,check}=require('../db');
const {uuid,rpcRoute}=require('../services/rpc');
const {newToken,hashToken}=require('../tokens');
const {verifyIdentity,identityFailure}=require('../services/verify-identity');
const {rateLimit}=require('../http-security');
const router=express.Router({mergeParams:true});
function validate(body,reauth=false){
 const fields=['targetUserId','organizationVersion','ownerVersion','targetVersion',...(reauth?['password','totpCode','totpFactorId']:['confirmed'])];
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k))||!uuid(body.targetUserId)||!['organizationVersion','ownerVersion','targetVersion'].every(k=>Number.isSafeInteger(body[k])&&body[k]>0&&body[k]<=2147483647)||(!reauth&&body.confirmed!==true))throw Error('Review and confirm the current owner and target administrator.');
 return {targetUserId:body.targetUserId,organizationVersion:body.organizationVersion,ownerVersion:body.ownerVersion,targetVersion:body.targetVersion};
}
const command=(req,action,data={})=>db().rpc('organization_ownership',{p_actor:req.user.id,p_action:action,p_id:req.params.id,p_data:{...data,currentHash:req.portalSession.token_hash}}).then(check);
router.get('/preview',rpcRoute(req=>{
 if(!uuid(req.query.targetUserId)||Object.keys(req.query).some(k=>k!=='targetUserId')){const e=Error('Choose a valid target administrator.');e.validation=true;throw e;}
 return command(req,'preview',{targetUserId:req.query.targetUserId});
}));
router.post('/reauthenticate',rateLimit({limit:10,windowMs:15*60*1000}),rpcRoute(async(req,res)=>{
 let intent;try{intent=validate(req.body,true);}catch(e){e.validation=true;throw e;}
 const preview=await command(req,'preview',{targetUserId:intent.targetUserId});
 if(['organizationVersion','ownerVersion','targetVersion'].some(k=>preview[k]!==intent[k]))return res.status(409).json({message:'Ownership review is stale. Reload and review again.'});
 let identity;try{identity=await verifyIdentity({email:req.user.email,password:req.body.password,totpCode:req.body.totpCode,totpFactorId:req.body.totpFactorId},{expectedUserId:req.user.id});}catch(e){if(identityFailure(e,res))return;throw e;}
 const proof=newToken(),grant=await command(req,'authorize',{...intent,proofHash:hashToken(proof),assurance:identity.assurance,verifiedAt:new Date().toISOString()});
 return {proof,expiresAt:grant.expiresAt};
}));
router.post('/transfer',rpcRoute(req=>{
 let intent;try{intent=validate(req.body);}catch(e){e.validation=true;throw e;}
 const proof=req.get('X-VSPH-Step-Up');if(typeof proof!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(proof)){const e=Error('Fresh ownership verification is required.');e.validation=true;throw e;}
 return command(req,'transfer',{...intent,confirmed:true,proofHash:hashToken(proof)});
}));
module.exports={router,validate};
