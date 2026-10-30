const express=require('express');
const {db,check}=require('../db');const{portalSession}=require('../security');
const router=express.Router();router.use(portalSession);
router.get('/',async(req,res,next)=>{try{
  if(req.user.platform_role==='super_admin'){
    const {count,error}=await db().from('organizations').select('*',{count:'exact',head:true});if(error)throw error;
    return res.json({count});
  }
  const memberships=check(await db().from('organization_memberships').select('organization_id').eq('user_id',req.user.id).eq('status','active'));
  const orgs=check(await db().from('organizations').select('id').in('id',memberships.map(m=>m.organization_id).length?memberships.map(m=>m.organization_id):['00000000-0000-0000-0000-000000000000']).eq('status','active'));
  res.json({count:orgs.length});
}catch(err){next(err)}});module.exports=router;
