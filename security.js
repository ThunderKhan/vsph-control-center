const {db,check} = require('./db');
const {permittedContexts}=require('./access-policy');
const {newToken,hashToken,cookieOptions,appCookie,SESSION_HOURS}=require('./tokens');
function isFuture(iso) {return new Date(iso).getTime()>Date.now();}
// Page navigations go to the proper sign-in screen. API calls retain JSON
// 401 errors so consumers cannot accidentally interpret HTML as API data.
function isPageNavigation(req) {
 const target=String(req.originalUrl||req.url||'');
 return req.method==='GET' && !target.startsWith('/api/');
}
function portalDenied(req,res,message) {
 if(isPageNavigation(req))return res.redirect(302,'/login');
 return res.status(401).json({message});
}
function appDenied(req,res,message,code) {
 if(isPageNavigation(req))return res.redirect(302,'/apps/'+encodeURIComponent(code.toLowerCase())+'/login');
 return res.status(401).json({message});
}
async function portalSession(req,res,next){
  try{
    const raw=req.cookies?.['vsph.portal.sid'];
    if(!raw) return portalDenied(req,res,'Please log in.');
    const session=check(await db().from('portal_sessions').select('token_hash,user_id,expires_at').eq('token_hash',hashToken(raw)).maybeSingle());
    if(!session||!isFuture(session.expires_at))return portalDenied(req,res,'Portal session expired. Please log in.');
    const user=check(await db().from('profiles').select('id,full_name,email,status,platform_role').eq('id',session.user_id).maybeSingle());
    if(!user||user.status!=='active')return portalDenied(req,res,'Account is disabled or unavailable.');
    req.portalSession=session; req.user=user; next();
  }catch(err){next(err)}
}
async function optionalPortal(req,res,next) {
  if(!req.cookies?.['vsph.portal.sid'])return next();
  return portalSession(req,res,next);
}
function requireAdmin(req,res,next){if(req.user?.platform_role!=='super_admin')return res.status(403).json({message:'Platform Super Admin required.'});next()}
async function getApp(code){return check(await db().from('applications').select('id,code,name,login_path,status').eq('code',String(code||'').toUpperCase()).maybeSingle())}
async function getContexts(user,app){
 if(!app||app.status!=='active')return [];
 const [subscriptions,grants,organizations]=await Promise.all([
  db().from('subscriptions').select('organization_id,application_id,status,ends_at').eq('application_id',app.id),
  db().from('organization_app_access').select('organization_id,application_id,status').eq('application_id',app.id),
  db().from('organizations').select('id,name,slug,status')
 ]);
 const subs=check(subscriptions),access=check(grants),orgs=check(organizations);
 let roles=[],memberships=[];
 if(user.platform_role!=='super_admin'){
  roles=check(await db().from('user_app_roles').select('organization_id,application_id,user_id,role_code').eq('user_id',user.id).eq('application_id',app.id));
  memberships=check(await db().from('organization_memberships').select('organization_id,user_id,status').eq('user_id',user.id));
 }
 return permittedContexts({user,app,organizations:orgs,subscriptions:subs,grants:access,memberships,roles});
}
async function requireApp(req,res,next){
 try{
  const code=String(req.params.app||'').toUpperCase();
  const raw=req.cookies?.[appCookie(code)];
  if(!raw)return appDenied(req,res,'Sign into the application first.',code);
  const session=check(await db().from('app_sessions').select('*').eq('token_hash',hashToken(raw)).eq('portal_token_hash',req.portalSession.token_hash).eq('user_id',req.user.id).maybeSingle());
  if(!session||!isFuture(session.expires_at))return appDenied(req,res,'Application session expired. Sign in again.',code);
  const app=await getApp(code);
  if(!app||app.id!==session.application_id)return res.status(403).json({message:'Application access denied.'});
  const contexts=await getContexts(req.user,app);
  const context=contexts.find(x=>x.id===session.organization_id);
  if(!context)return res.status(403).json({message:'Organization access has been revoked.'});
  req.appContext={app,organization:context,role:context.role};next();
 }catch(err){next(err)}
}
function validateOrigin(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 // Validate browser write requests to protect cookie-backed sessions from CSRF.
 const origin=req.get('origin');
 const expected=process.env.PUBLIC_ORIGIN || `http://localhost:${process.env.PORT||3000}`;
 if(!origin || origin!==expected)return res.status(403).json({message:'Request origin not permitted.'});
 next();
}
module.exports={newToken,hashToken,cookieOptions,appCookie,portalSession,optionalPortal,requireAdmin,getApp,getContexts,requireApp,validateOrigin,SESSION_HOURS};
