const express=require('express');const crypto=require('node:crypto');
const {db,check}=require('../db');const {optionalPortal}=require('../security');
const {uuid,rpcRoute}=require('../services/rpc');const {hash}=require('../services/invitation-worker');
const router=express.Router();router.use(optionalPortal);
function proof(req){
 const {invitationId,token}=req.body||{};
 if(!uuid(invitationId)||typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)){const e=Error('Use a current invitation email. Legacy account-wide activation is unavailable.');e.validation=true;throw e;}
 return {id:invitationId,tokenHash:hash(token)};
}
router.post('/inspect',rpcRoute(async req=>{const p=proof(req);return check(await db().rpc('provisioning_command',{p_actor:null,p_action:'inspect',p_id:p.id,p_data:{tokenHash:p.tokenHash}}));}));
router.post('/accept',rpcRoute(async(req)=>{
 const p=proof(req),acceptanceId=crypto.randomUUID();
 const client=db();const cmd=(action,data={})=>client.rpc('provisioning_command',{p_actor:req.user?.id||null,p_action:action,p_id:p.id,p_data:{tokenHash:p.tokenHash,acceptanceId,...data}}).then(check);
 const info=await cmd('inspect');
 if(info.newIdentity&&(typeof req.body.password!=='string'||req.body.password.length<12||req.body.password.length>128)){const e=Error('Choose a password of 12–128 characters.');e.validation=true;throw e;}
 const reservation=await cmd('reserve_accept');
 try{
  // Only the new disabled identity owned by this invitation can enroll a password.
  // Existing users must authenticate; this endpoint never changes their password.
  if(reservation.newIdentity){const r=await client.auth.admin.updateUserById(reservation.userId,{password:req.body.password,email_confirm:true});if(r.error)throw r.error;}
  await cmd('finish_accept');return {message:'Invitation accepted for this customer workspace. Sign in to continue.'};
 }catch(e){await cmd('accept_failed');throw e;}
}));module.exports=router;
