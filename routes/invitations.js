const express=require('express');
const {db,check}=require('../db');
const router=express.Router();

router.post('/accept',async(req,res,next)=>{
  try{
    const accessToken=String(req.body?.accessToken||'');
    const password=String(req.body?.password||'');
    if(!accessToken || accessToken.length>6000 || password.length<12 || password.length>128)
      return res.status(400).json({message:'A valid invitation and password of 12–128 characters are required.'});
    const client=db();
    // Verify the bearer access token against Supabase Auth; never use a user ID
    // supplied by the browser to select an account or activate a tenant.
    const verified=await client.auth.getUser(accessToken);
    if(verified.error || !verified.data?.user?.id)
      return res.status(401).json({message:'Invitation expired or invalid. Request a new invitation.'});
    const userId=verified.data.user.id;
    const user=check(await client.from('profiles').select('id,status,email').eq('id',userId).maybeSingle());
    if(!user || user.status!=='active')
      return res.status(403).json({message:'Account is not enabled.'});
    const pending=check(await client.from('organization_memberships')
      .select('organization_id,status').eq('user_id',userId).eq('status','invited'));
    if(!pending.length)
      return res.status(403).json({message:'There is no pending VSPH customer invitation for this account.'});
    const changed=await client.auth.admin.updateUserById(userId,{password});
    if(changed.error)throw changed.error;
    const activated=await client.from('organization_memberships')
      .update({status:'active'}).eq('user_id',userId).eq('status','invited');
    check(activated);
    res.set('Cache-Control','no-store');
    res.json({message:'Your password is set and your customer workspace access is active. Sign in to continue.'});
  }catch(err){next(err)}
});
module.exports=router;
