// Explicit, server-only email transport for internal employee enrollment.
// This never stores or logs a plaintext invite URL. A 2xx response means that
// the provider accepted the request, NOT that the mailbox received the email.
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function senderConfig(env=process.env){
 const raw=env.EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL;
 if(!raw)return null;
 let endpoint;
 try{endpoint=new URL(raw);}catch{return null;}
 const local=env.NODE_ENV!=='production'&&endpoint.protocol==='http:'&&['localhost','127.0.0.1'].includes(endpoint.hostname);
 if((endpoint.protocol!=='https:'&&!local)||endpoint.username||endpoint.password||endpoint.hash)return null;
 return {url:endpoint.toString(),token:env.EMPLOYEE_INVITATION_EMAIL_WEBHOOK_TOKEN||''};
}
const isConfigured=(env=process.env)=>Boolean(senderConfig(env));
async function submit({to,inviteUrl},{env=process.env,fetchImpl=fetch}={}){
 const config=senderConfig(env);
 if(!config||typeof to!=='string'||!emailPattern.test(to)||typeof inviteUrl!=='string')return false;
 const subject='Set up your VSPH employee account';
 const text=['Hello,','','You have been invited to set up your VSPH employee login.',
  'Open this private link to choose your password and accept the employment account:',
  inviteUrl,'','This single-use link expires after seven days. If you did not expect this invitation, ignore this email.'].join('\n');
 try{
  const response=await fetchImpl(config.url,{method:'POST',headers:{'Content-Type':'application/json',...(config.token?{Authorization:'Bearer '+config.token}:{})},
   body:JSON.stringify({to,subject,text,type:'employee_invitation'}),signal:AbortSignal.timeout(8000),redirect:'error'});
  return response.ok===true;
 }catch{return false;}
}
module.exports={isConfigured,submit,senderConfig};
