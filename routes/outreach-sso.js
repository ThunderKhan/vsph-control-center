const express=require('express');
const {db,check}=require('../db');
const {portalSession,requireAdmin}=require('../security');
const {newToken}=require('../tokens');
const {CLIENT_ID,APP_CODE,B64URL,outreachConfig,hash,pkce,verifySecret}=
  require('../integration/outreach-config');

const router=express.Router();
function noStore(res){
  res.set('Cache-Control','no-store');
  res.set('Referrer-Policy','no-referrer');
}
function safeUuid(v){return typeof v==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);}
async function access(req) {
  // Only the server may choose actor and portal-session hash.
  return check(await db().rpc('outreach_current_access',{
    p_user:req.user.id,p_session:req.portalSession.token_hash,
  }));
}
router.get('/authorize',portalSession,async(req,res,next)=>{
  try{
    noStore(res);
    const cfg=outreachConfig();
    if(!cfg)return res.status(503).send('Outreach launch is not configured.');
    if(req.query.client_id!==CLIENT_ID||req.query.app!==APP_CODE||
      !B64URL.test(String(req.query.state||''))||
      !B64URL.test(String(req.query.code_challenge||''))||
      req.query.code_challenge_method!=='S256'||
      Object.keys(req.query).some(k=>!['client_id','app','state','code_challenge','code_challenge_method'].includes(k)))
      return res.status(400).send('Invalid Outreach authorization request.');
    if(!(await access(req)))return res.status(403).send('Outreach employee access denied.');
    const code=newToken();
    check(await db().rpc('outreach_issue_code',{
      p_actor:req.user.id,p_session:req.portalSession.token_hash,
      p_code_hash:hash(code),p_challenge:req.query.code_challenge,
    }));
    const callback=new URL(cfg.callbackUrl);
    callback.searchParams.set('code',code);
    callback.searchParams.set('state',req.query.state);
    res.redirect(303,callback.toString());
  }catch(err){next(err);}
});
async function exchange(req,res,next) {
  try {
    noStore(res);
    const cfg=outreachConfig();
    if(!cfg||!verifySecret(req.get('x-vsph-client-secret'),cfg.secret))
      return res.status(401).json({message:'Confidential client denied.'});
    const {client_id,code,code_verifier}=req.body||{};
    if(client_id!==CLIENT_ID||typeof code!=='string'||!B64URL.test(code)||
      typeof code_verifier!=='string'||!B64URL.test(code_verifier))
      return res.status(400).json({message:'Invalid exchange request.'});
    const result=check(await db().rpc('outreach_consume_code',{
      p_code_hash:hash(code),p_challenge:pkce(code_verifier),
    }));
    if(!result||result.application!==APP_CODE||!safeUuid(result.user_id)||
      !/^[a-f0-9]{64}$/.test(result.portal_session_ref||'')||
      !['administrator','manager','representative','analyst'].includes(result.role))
      return res.status(401).json({message:'Expired or revoked launch.'});
    res.json({application:APP_CODE,user_id:result.user_id,
      role:result.role,portal_session_ref:result.portal_session_ref});
  }catch(err){next(err);}
}
async function introspect(req,res,next){
  try{
    noStore(res);
    const cfg=outreachConfig();
    if(!cfg||!verifySecret(req.get('x-vsph-client-secret'),cfg.secret))
      return res.status(401).json({active:false});
    const {client_id,user_id,portal_session_ref}=req.body||{};
    if(client_id!==CLIENT_ID||!safeUuid(user_id)||
      typeof portal_session_ref!=='string'||!/^[a-f0-9]{64}$/.test(portal_session_ref))
      return res.status(400).json({active:false});
    const result=check(await db().rpc('outreach_introspect',{
      p_user:user_id,p_session:portal_session_ref,
    }));
    if(!result?.active||result.application!==APP_CODE||
      result.user_id!==user_id||
      !['administrator','manager','representative','analyst'].includes(result.role))
      return res.status(403).json({active:false});
    res.json({active:true,application:APP_CODE,user_id,role:result.role});
  }catch(err){next(err);}
}
const accessRouter=express.Router();
accessRouter.use(portalSession,requireAdmin,(req,res,next)=>{noStore(res);next();});
async function accessCommand(req,action,userId=null,role=null){
  return check(await db().rpc('outreach_access_command',{
    p_actor:req.user.id,p_session:req.portalSession.token_hash,
    p_action:action,p_target:userId,p_role:role,
  }));
}
accessRouter.get('/',async(req,res,next)=>{
  try{res.json(await accessCommand(req,'list'));}catch(err){next(err);}
});
accessRouter.put('/:id',async(req,res,next)=>{
  try{
    if(!safeUuid(req.params.id)||!req.body||Object.keys(req.body).length!==1||
      !['administrator','manager','representative','analyst'].includes(req.body.role))
      return res.status(400).json({message:'Valid employee ID and role required.'});
    res.json(await accessCommand(req,'grant',req.params.id,req.body.role));
  }catch(err){next(err);}
});
accessRouter.delete('/:id',async(req,res,next)=>{
  try{
    if(!safeUuid(req.params.id)||Object.keys(req.body||{}).length)
      return res.status(400).json({message:'Valid employee ID required.'});
    res.json(await accessCommand(req,'revoke',req.params.id));
  }catch(err){next(err);}
});
module.exports={router,exchange,introspect,accessRouter,access};
