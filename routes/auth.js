const express=require('express');
const {db,publicAuth,check}=require('../db');
const {newToken,hashToken,cookieOptions,appCookie,portalSession,getApp,getContexts,SESSION_HOURS}=require('../security');
const router=express.Router();
const expiry=()=>new Date(Date.now()+SESSION_HOURS*3600000).toISOString();
async function verifyCredentials(email,password){
 const {data,error}=await publicAuth().auth.signInWithPassword({email,password});
 return error?null:data.user;
}
router.post('/login',async(req,res,next)=>{
 try{
  const email=String(req.body.email||'').trim().toLowerCase();const password=String(req.body.password||'');
  if(!email||!password)return res.status(400).json({message:'Email and password are required.'});
  const authUser=await verifyCredentials(email,password);
  if(!authUser)return res.status(401).json({message:'Invalid credentials or email not confirmed.'});
  const user=check(await db().from('profiles').select('*').eq('id',authUser.id).eq('status','active').maybeSingle());
  if(!user)return res.status(403).json({message:'Account is not enabled.'});
  const raw=newToken();const token_hash=hashToken(raw);
  check(await db().from('portal_sessions').insert({token_hash,user_id:user.id,expires_at:expiry()}));
  res.cookie('vsph.portal.sid',raw,cookieOptions());
  res.json({message:'Signed in.',user:{id:user.id,name:user.full_name,email:user.email,platformRole:user.platform_role}});
 }catch(err){next(err)}
});
router.get('/me',portalSession,(req,res)=>res.json({user:{id:req.user.id,name:req.user.full_name,email:req.user.email,platformRole:req.user.platform_role}}));
router.post('/app-login',portalSession,async(req,res,next)=>{
 try{
  const code=String(req.body.app||'').toUpperCase();
  const email=String(req.body.email||'').trim().toLowerCase();
  const password=String(req.body.password||'');const organizationId=String(req.body.organizationId||'');
  const app=await getApp(code);if(!app||app.status!=='active')return res.status(404).json({message:'Application unavailable.'});
  const contexts=await getContexts(req.user,app);
  const context=contexts.find(x=>x.id===organizationId);
  if(!context)return res.status(403).json({message:'You do not have access to that customer workspace.'});
  if(email!==req.user.email)return res.status(403).json({message:'Use your signed-in portal account.'});
  const authUser=await verifyCredentials(email,password);
  if(!authUser||authUser.id!==req.user.id)return res.status(401).json({message:'Incorrect application sign-in credentials.'});
  const raw=newToken();
  check(await db().from('app_sessions').insert({token_hash:hashToken(raw),portal_token_hash:req.portalSession.token_hash,user_id:req.user.id,application_id:app.id,organization_id:context.id,expires_at:expiry()}));
  res.cookie(appCookie(code),raw,cookieOptions());
  res.json({message:'Application signed in.',redirect:`/apps/${code.toLowerCase()}/home`});
 }catch(err){next(err)}
});
router.post('/app-logout',portalSession,async(req,res,next)=>{
 try{
  const code=String(req.body.app||'').toUpperCase();
  if(!/^[A-Z][A-Z0-9_]{1,39}$/.test(code))return res.status(400).json({message:'Invalid application.'});
  const raw=req.cookies?.[appCookie(code)];
  if(raw)check(await db().from('app_sessions').delete().eq('token_hash',hashToken(raw)).eq('portal_token_hash',req.portalSession.token_hash));
  res.clearCookie(appCookie(code),{path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production'});
  res.json({message:'Application signed out.'});
 }catch(err){next(err)}
});
router.post('/logout',async(req,res,next)=>{
 try{
  const raw=req.cookies?.['vsph.portal.sid'];
  if(raw)check(await db().from('portal_sessions').delete().eq('token_hash',hashToken(raw)));
  res.clearCookie('vsph.portal.sid',{path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production'});
  for(const app of ['CRM','MUSIC'])res.clearCookie(appCookie(app),{path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production'});
  res.json({message:'Signed out.'});
 }catch(err){next(err)}
});
module.exports=router;
