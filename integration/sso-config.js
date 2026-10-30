const crypto = require('node:crypto');

const CLIENT_ID = 'music-vercel';
const ALLOWED_CODE = 'MUSIC';
const CODE_TTL_MS = 60_000;
const B64URL = /^[A-Za-z0-9_-]{43,128}$/;

function requireHttpsUrl(raw, route) {
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && local && url.protocol === 'http:')) ||
      !url.pathname.endsWith(route)) {
    throw new Error('Unsafe Music SSO endpoint configuration.');
  }
  return url;
}

// No hardcoded Vercel preview deployment or database-supplied redirect targets.
function musicConfig() {
  const {MUSIC_SSO_START_URL, MUSIC_SSO_CALLBACK_URL, MUSIC_SSO_CLIENT_SECRET} = process.env;
  if (![MUSIC_SSO_START_URL,MUSIC_SSO_CALLBACK_URL,MUSIC_SSO_CLIENT_SECRET].some(Boolean)) return null;
  if (![MUSIC_SSO_START_URL,MUSIC_SSO_CALLBACK_URL,MUSIC_SSO_CLIENT_SECRET].every(Boolean) ||
      MUSIC_SSO_CLIENT_SECRET.length < 32) throw new Error('Incomplete Music SSO configuration.');
  const start=requireHttpsUrl(MUSIC_SSO_START_URL,'/api/sso/start');
  const callback=requireHttpsUrl(MUSIC_SSO_CALLBACK_URL,'/api/sso/callback');
  if (start.origin !== callback.origin) throw new Error('Music SSO endpoints must have the same origin.');
  return {clientId:CLIENT_ID,startUrl:start.toString(),callbackUrl:callback.toString(),secret:MUSIC_SSO_CLIENT_SECRET};
}
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function challenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
function isB64Url(value) { return typeof value === 'string' && B64URL.test(value); }
function verifySecret(supplied,secret) {
  if(typeof supplied!=='string' || typeof secret!=='string')return false;
  const left=crypto.createHash('sha256').update(supplied).digest();
  const right=crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(left,right) && supplied.length===secret.length;
}
module.exports={CLIENT_ID,ALLOWED_CODE,CODE_TTL_MS,musicConfig,hash,challenge,isB64Url,verifySecret};
