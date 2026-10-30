const crypto=require('node:crypto');
const {db,check}=require('../db');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function crypt(value,key,decrypt=false){
 if(!/^[0-9a-f]{64}$/i.test(key||''))throw Error('INVITATION_OUTBOX_KEY must contain 32 hex-encoded bytes.');
 if(decrypt){const [iv,tag,body]=value.split('.').map(x=>Buffer.from(x,'base64url'));const c=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);c.setAuthTag(tag);return Buffer.concat([c.update(body),c.final()]).toString()}
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
 const body=Buffer.concat([c.update(value),c.final()]);return [iv,c.getAuthTag(),body].map(x=>x.toString('base64url')).join('.');
}
async function dispatchOne({client,deliver,key=process.env.INVITATION_OUTBOX_KEY,origin=process.env.PUBLIC_ORIGIN}={}){
 if(typeof deliver!=='function')throw Error('Explicit delivery adapter required.');
 const url=new URL(origin);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Trusted HTTPS origin required.');
 crypt('configuration-check',key);client=client||db();
 const lease=crypto.randomUUID();
 const command=(action,id,data={})=>client.rpc('provisioning_command',{p_actor:null,p_action:action,p_id:id,p_data:{...data,lease}}).then(check);
 const work=await command('claim',lease);if(!work)return false;
 const {outbox:o,invitation:i,job:j}=work;
 try{
  let encrypted=o.encrypted_delivery;
  if(!encrypted){
   let userId=i.user_id;
   if(!userId){
    const existing=check(await client.from('profiles').select('id').eq('email',i.email).maybeSingle());userId=existing?.id;
    if(!userId){
     userId=i.auth_user_id;
     let auth=await client.auth.admin.getUserById(userId);
     if(!auth.data?.user){auth=await client.auth.admin.createUser({id:userId,email:i.email,password:crypto.randomBytes(48).toString('base64url'),email_confirm:false})}
     if(auth.error||auth.data?.user?.id!==userId||auth.data.user.email?.toLowerCase()!==i.email)throw Error('Identity provisioning failed');
    }
   }
   const token=crypto.randomBytes(32).toString('base64url');
   const invite=new URL('/accept-invite',url);invite.hash=new URLSearchParams({invitation_id:i.id,invitation_token:token}).toString();
   encrypted=crypt(JSON.stringify({to:i.email,url:invite.toString(),name:j.request.adminName}),key);
   await command('bind',o.id,{userId,tokenHash:hash(token),encryptedDelivery:encrypted});
  }
  await deliver({...JSON.parse(crypt(encrypted,key,true)),idempotencyKey:i.id+':'+i.generation});
  await command('sent',o.id);return true;
 }catch(e){await command('failed',o.id);throw Error('Invitation delivery requires retry or reconciliation.');}
}
module.exports={dispatchOne,crypt,hash};
