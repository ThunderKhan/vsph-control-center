const crypto=require('node:crypto');
const SESSION_HOURS=4;
const cookieSecure=()=>process.env.NODE_ENV==='production';
const cookieOptions=()=>({httpOnly:true,secure:cookieSecure(),sameSite:'lax',path:'/',maxAge:SESSION_HOURS*3600000});
function newToken(){return crypto.randomBytes(32).toString('base64url')}
function hashToken(raw){return crypto.createHash('sha256').update(String(raw||'')).digest('hex')}
function appCookie(code){return `vsph.${String(code).toLowerCase()}.sid`}
module.exports={newToken,hashToken,cookieOptions,appCookie,SESSION_HOURS};
