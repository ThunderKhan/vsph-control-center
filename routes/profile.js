const express=require('express'),path=require('node:path');
const {portalSession}=require('../security'),{db,check}=require('../db'),{rpcRoute}=require('../services/rpc');
const router=express.Router();router.use(portalSession,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
function invalid(){const e=Error('Review your display name, bio, time zone and avatar choice.');e.validation=true;throw e;}
function validate(body){
 const keys=['displayName','bio','timeZone','avatarTone','version'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==keys.length||Object.keys(body).some(k=>!keys.includes(k)))invalid();
 if(typeof body.displayName!=='string'||!body.displayName.trim()||body.displayName.trim().length>150||typeof body.bio!=='string'||body.bio.length>500||(/[\u0000-\u001f\u007f]/.test(body.displayName)||/[\u0000-\u0009\u000b-\u001f\u007f]/.test(body.bio))||typeof body.timeZone!=='string'||body.timeZone.length>100||!['navy','blue','slate'].includes(body.avatarTone)||!Number.isInteger(body.version)||body.version<0||body.version>2147483646)invalid();
 try{new Intl.DateTimeFormat('en-IN',{timeZone:body.timeZone});}catch{invalid();}
 return {...body,displayName:body.displayName.trim()};
}
const command=(req,action,data={})=>db().rpc('account_profile',{p_actor:req.user.id,p_action:action,p_id:null,p_data:{...data,currentHash:req.portalSession.token_hash}}).then(check);
router.get('/',rpcRoute(req=>{if(Object.keys(req.query).length)invalid();return command(req,'get');}));
router.patch('/',rpcRoute(req=>{if(Object.keys(req.query).length)invalid();return command(req,'save',validate(req.body));}));
function page(req,res){res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'..','views','account-profile.html'));}
module.exports={router,validate,page};
