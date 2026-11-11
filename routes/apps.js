const express=require('express');
const {db,check}=require('../db');
const {portalSession,getApp,getContexts,requireApp}=require('../security');
const {canCreateRecord,adapter,diagnostics,payload:recordPayload}=require('../products/adapters');
const outreachSso=require('./outreach-sso');
const router=express.Router();
router.use(portalSession);
router.get('/',async(req,res,next)=>{
 try{
  const apps=check(await db().from('applications').select('id,code,name,login_path,status').eq('status','active').eq('visibility','listed').order('name'));
  const permitted=[];
  for(const app of apps){
    if(app.code==='OUTREACH'){
      if(await outreachSso.access(req))permitted.push(app);
    }else if(req.user.platform_role==='super_admin'||(await getContexts(req.user,app)).length)permitted.push(app);
  }
  res.json({applications:permitted});
 }catch(err){next(err)}
});
router.get('/:app/contexts',async(req,res,next)=>{
 try{
  const app=await getApp(req.params.app);
  if(!app||app.status!=='active')return res.status(404).json({message:'Application unavailable.'});
  if(app.code==='OUTREACH'){
    const role=await outreachSso.access(req);
    if(!role)return res.status(403).json({message:'Outreach employee access denied.'});
    return res.json({application:app,organizations:[],internal:{role,label:'VSPH Internal'},email:req.user.email});
  }
  res.json({application:app,organizations:await getContexts(req.user,app),email:req.user.email});
 }catch(err){next(err)}
});
router.get('/:app/context',requireApp,(req,res)=>res.json({application:req.appContext.app,organization:req.appContext.organization,role:req.appContext.role,capabilities:{createRecords:canCreateRecord(req.appContext.app.code,req.appContext.role)},integration:diagnostics(req.appContext.app.code),user:{name:req.user.full_name,email:req.user.email}}));
router.get('/:app/records',requireApp,async(req,res,next)=>{
 try{
  const{app,organization}=req.appContext;
  const selected=adapter(app.code);if(!selected)return res.json({records:[],configured:false});
  const table=selected.table;
  const records=check(await db().from(table).select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(100));
  res.json({records});
 }catch(err){next(err)}
});
router.post('/:app/records',requireApp,async(req,res,next)=>{
 try{
  const{app,organization,role}=req.appContext;
  if(!canCreateRecord(app.code,role))return res.status(403).json({message:'This product role cannot create records.'});
  const selected=adapter(app.code),payload=recordPayload(app.code,req.body);
  if(!selected||!payload)return res.status(400).json({message:'Valid adapter record data is required.'});
  const table=selected.table;
  const record=check(await db().from(table).insert({...payload,organization_id:organization.id,created_by:req.user.id}).select('*').single());
  res.status(201).json({record});
 }catch(err){next(err)}
});
module.exports=router;

