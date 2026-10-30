const express = require('express');
const {db,check} = require('../db');
const {portalSession,getApp,getContexts,newToken} = require('../security');
const {CLIENT_ID,ALLOWED_CODE,CODE_TTL_MS,musicConfig,hash,challenge,isB64Url,verifySecret} = require('../integration/sso-config');

const router=express.Router();
router.use(portalSession);
const noStore=res=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');};
const appContexts=async user=>{
  const app=await getApp(ALLOWED_CODE);
  if(!app || app.status!=='active')return null;
  return {app,organizations:await getContexts(user,app)};
};

// Configuration is only exposed to logged-in accounts with access to Music.
// The client secret and service-only exchange remain strictly server-side.
router.get('/config/MUSIC',async(req,res,next)=>{
  try{
    noStore(res);
    const context=await appContexts(req.user);
    if(!context || !context.organizations.length)return res.status(403).json({message:'No authorized Music workspace.'});
    const cfg=musicConfig();
    res.json({
      enabled:Boolean(cfg),
      startUrl:cfg?.startUrl || null,
      organizations:context.organizations.map(org=>({id:org.id,name:org.name,role:org.role}))
    });
  }catch(err){next(err)}
});

// Authorization request is initiated by the Music backend after it sets a
// SameSite=Lax, HttpOnly state+PKCE cookie. Never trust a redirect_uri parameter.
router.get('/authorize',async(req,res,next)=>{
  try{
    noStore(res);
    const cfg=musicConfig();
    if(!cfg)return res.status(503).send('External Music sign-in is not configured.');
    if(req.query.client_id!==CLIENT_ID || req.query.app!==ALLOWED_CODE ||
       !isB64Url(req.query.state) || !isB64Url(req.query.code_challenge) ||
       req.query.code_challenge_method!=='S256' ||
       typeof req.query.organization_id!=='string')return res.status(400).send('Invalid authorization request.');
    const context=await appContexts(req.user);
    const org=context?.organizations.find(o=>o.id===req.query.organization_id);
    if(!org)return res.status(403).send('Music access denied for this organization.');
    const code=newToken();
    check(await db().from('sso_launch_codes').insert({
      code_hash:hash(code),client_id:CLIENT_ID,application_id:context.app.id,
      user_id:req.user.id,portal_token_hash:req.portalSession.token_hash,
      organization_id:org.id,code_challenge:req.query.code_challenge,
      expires_at:new Date(Date.now()+CODE_TTL_MS).toISOString()
    }));
    const callback=new URL(cfg.callbackUrl);
    callback.searchParams.set('code',code);
    callback.searchParams.set('state',req.query.state);
    return res.redirect(303,callback.toString());
  }catch(err){next(err)}
});

// Authenticated back-channel only: mount BEFORE the browser Origin validator.
// A browser cannot obtain the confidential Music client secret, and this route
// never reads browser cookies. The DB function consumes codes atomically.
async function exchange(req,res,next){
  try{
    noStore(res);
    const cfg=musicConfig();
    const secret=req.get('x-vsph-client-secret');
    if(!cfg || !verifySecret(secret,cfg.secret))return res.status(401).json({message:'Unauthorized client.'});
    const {client_id,code,code_verifier}=req.body||{};
    if(client_id!==CLIENT_ID || !isB64Url(code) || !isB64Url(code_verifier))return res.status(400).json({message:'Invalid exchange request.'});
    const consumed=check(await db().rpc('consume_sso_launch_code',{p_code_hash:hash(code)}));
    const launch=Array.isArray(consumed)?consumed[0]:consumed;
    if(!launch || launch.client_id!==CLIENT_ID || launch.code_challenge!==challenge(code_verifier))
      return res.status(401).json({message:'Invalid or expired launch code.'});

    // Recheck session and current authorization at redemption time; role and
    // organization labels are computed from the database, never a URL.
    const session=check(await db().from('portal_sessions').select('token_hash,user_id,expires_at').eq('token_hash',launch.portal_token_hash).maybeSingle());
    if(!session || session.user_id!==launch.user_id || new Date(session.expires_at).getTime()<=Date.now())
      return res.status(401).json({message:'Portal session unavailable.'});
    const user=check(await db().from('profiles').select('id,full_name,email,status').eq('id',launch.user_id).maybeSingle());
    if(!user || user.status!=='active')return res.status(403).json({message:'User is not active.'});
    const context=await appContexts({...user,platform_role:(check(await db().from('profiles').select('platform_role').eq('id',user.id).maybeSingle()))?.platform_role});
    const org=context?.organizations.find(o=>o.id===launch.organization_id);
    if(!org || context.app.id!==launch.application_id)return res.status(403).json({message:'Music entitlement revoked.'});
    return res.json({
      user:{id:user.id,email:user.email,name:user.full_name},
      application:{code:ALLOWED_CODE,id:context.app.id},
      organization:{id:org.id,name:org.name},
      role:org.role
    });
  }catch(err){next(err)}
}
module.exports={router,exchange};
