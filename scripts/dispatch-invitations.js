require('dotenv').config();
const {dispatchOne}=require('../services/invitation-worker');
// Explicit operator command only; never started by the web server.
(async()=>{
 if(process.env.INVITATION_DELIVERY_ENABLED!=='true')throw Error('Delivery disabled. Approval and provider configuration are required.');
 const target=new URL(process.env.INVITATION_DELIVERY_URL);if(target.protocol!=='https:')throw Error('HTTPS provider required.');
 if(!process.env.INVITATION_DELIVERY_SECRET)throw Error('Provider authentication required.');
 const processed=await dispatchOne({deliver:async payload=>{
  const r=await fetch(target,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.INVITATION_DELIVERY_SECRET,'Idempotency-Key':payload.idempotencyKey},body:JSON.stringify(payload)});
  if(!r.ok)throw Error('Provider rejected request');
 }});console.log(JSON.stringify({processed}));
})().catch(()=>{console.error('Invitation dispatch failed; inspect recovery view.');process.exitCode=1});
