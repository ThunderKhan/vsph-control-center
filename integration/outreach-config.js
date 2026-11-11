const crypto = require('node:crypto');

const CLIENT_ID='outreach-internal';
const APP_CODE='OUTREACH';
const CODE_TTL_MS=60_000;
const B64URL=/^[A-Za-z0-9_-]{43,128}$/;

function endpoint(raw,suffix) {
  const url=new URL(raw);
  const dev=process.env.NODE_ENV!=='production' &&
    (url.hostname==='127.0.0.1'||url.hostname==='localhost');
  if(url.username||url.password||url.search||url.hash||url.pathname!==suffix ||
      (url.protocol!=='https:'&&!(dev&&url.protocol==='http:')))
    throw new Error('Unsafe Outreach SSO endpoint configuration.');
  return url;
}
function outreachConfig() {
  const {OUTREACH_SSO_START_URL,OUTREACH_SSO_CALLBACK_URL,OUTREACH_SSO_CLIENT_SECRET}=process.env;
  if(![OUTREACH_SSO_START_URL,OUTREACH_SSO_CALLBACK_URL,OUTREACH_SSO_CLIENT_SECRET].some(Boolean))return null;
  if(![OUTREACH_SSO_START_URL,OUTREACH_SSO_CALLBACK_URL,OUTREACH_SSO_CLIENT_SECRET].every(Boolean) ||
     OUTREACH_SSO_CLIENT_SECRET.length<32)
    throw new Error('Incomplete Outreach SSO configuration.');
  const start=endpoint(OUTREACH_SSO_START_URL,'/api/v1/sso/start');
  const callback=endpoint(OUTREACH_SSO_CALLBACK_URL,'/api/v1/sso/callback');
  if(start.origin!==callback.origin)throw new Error('Outreach endpoints must have the same origin.');
  return {startUrl:start.toString(),callbackUrl:callback.toString(),secret:OUTREACH_SSO_CLIENT_SECRET};
}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function pkce(value){return crypto.createHash('sha256').update(value).digest('base64url');}
function verifySecret(supplied,configured){
  if(typeof supplied!=='string'||typeof configured!=='string')return false;
  const a=hash(supplied),b=hash(configured);
  return supplied.length===configured.length&&
    crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
module.exports={CLIENT_ID,APP_CODE,CODE_TTL_MS,B64URL,outreachConfig,hash,pkce,verifySecret};
