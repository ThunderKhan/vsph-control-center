const express=require('express');
const {db,check}=require('../db');
const {portalSession,getApp,getContexts,requireApp}=require('../security');
const {canCreateRecord}=require('../access-policy');
const router=express.Router();
router.use(portalSession);
router.get('/',async(req,res,next)=>{
 try{
  const apps=check(await db().from('applications').select('id,code,name,login_path,status').eq('status','active').order('name'));
  const permitted=[];
  for(const app of apps){if(req.user.platform_role==='super_admin'||(await getContexts(req.user,app)).length)permitted.push(app)}
  res.json({applications:permitted});
 }catch(err){next(err)}
});
router.get('/:app/contexts',async(req,res,next)=>{
 try{
  const app=await getApp(req.params.app);
  if(!app||app.status!=='active')return res.status(404).json({message:'Application unavailable.'});
  res.json({application:app,organizations:await getContexts(req.user,app),email:req.user.email});
 }catch(err){next(err)}
});
router.get('/:app/context',requireApp,(req,res)=>res.json({application:req.appContext.app,organization:req.appContext.organization,role:req.appContext.role,capabilities:{createRecords:canCreateRecord(req.appContext.app.code,req.appContext.role)},user:{name:req.user.full_name,email:req.user.email}}));
router.get('/:app/records',requireApp,async(req,res,next)=>{
 try{
  const{app,organization}=req.appContext;
  if(!['CRM','MUSIC'].includes(app.code))return res.json({records:[]});
  const table=app.code==='CRM'?'crm_contacts':'music_requests';
  const records=check(await db().from(table).select('*').eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(100));
  res.json({records});
 }catch(err){next(err)}
});
router.post('/:app/records',requireApp,async(req,res,next)=>{
 try{
  const{app,organization,role}=req.appContext;
  if(!canCreateRecord(app.code,role))return res.status(403).json({message:'This product role cannot create records.'});
  let payload,table;
  if(app.code==='CRM'){
    const name=String(req.body.name||'').trim().slice(0,150),email=String(req.body.email||'').trim().slice(0,190),company=String(req.body.company||'').trim().slice(0,150);
    if(!name)return res.status(400).json({message:'Contact name is required.'});
    table='crm_contacts';payload={name,email:email||null,company:company||null};
  }else if(app.code==='MUSIC'){
    const song_title=String(req.body.song_title||'').trim().slice(0,150),artist=String(req.body.artist||'').trim().slice(0,150);
    if(!song_title)return res.status(400).json({message:'Song title is required.'});
    table='music_requests';payload={song_title,artist:artist||null};
  }else return res.status(404).json({message:'No module has been created for this application.'});
  const record=check(await db().from(table).insert({...payload,organization_id:organization.id,created_by:req.user.id}).select('*').single());
  res.status(201).json({record});
 }catch(err){next(err)}
});
module.exports=router;

