const {db,check} = require('./db');
const {performance}=require('node:perf_hooks');
const {PORTAL_SESSION_FIELDS}=require('./services/portal-session-fields');
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
// One source of truth for validating the portal cookie. Protected routes
// reject invalid sessions; public sign-in routes simply treat them as guests.
async function resolvePortalSession(req) {
  const raw=req.cookies?.['vsph.portal.sid'];
  if(!raw)return 'Please log in.';
  const row=check(await db().from('portal_sessions').select(PORTAL_SESSION_FIELDS).eq('token_hash',hashToken(raw)).maybeSingle());
  if(!row||!isFuture(row.expires_at))return 'Portal session expired. Please log in.';
  const user=row.profile;
  if(!user||Array.isArray(user)||user.id!==row.user_id||user.status!=='active')return 'Account is disabled or unavailable.';
  req.portalSession={token_hash:row.token_hash,user_id:row.user_id,expires_at:row.expires_at};req.user=user;
  return null;
}
function authTiming(res,start){if(typeof res.append==='function'&&!res.headersSent)res.append('Server-Timing','auth;dur='+Math.max(0,performance.now()-start).toFixed(1));}
async function portalSession(req,res,next){
  const start=performance.now();
  try{
    const denial=await resolvePortalSession(req);
    authTiming(res,start);
    if(denial)return portalDenied(req,res,denial);
    next();
  }catch(err){authTiming(res,start);next(err)}
}
async function optionalPortal(req,res,next){
  const start=performance.now();
  try{
    // A stale/disabled session must not redirect /login back into itself.
    await resolvePortalSession(req);
    authTiming(res,start);
    next();
  }catch(err){authTiming(res,start);next(err)}
}
function requireAdmin(req,res,next){if(req.user?.platform_role!=='super_admin')return res.status(403).json({message:'Platform Super Admin required.'});next()}
async function getApp(code){return check(await db().from('applications').select('id,code,name,login_path,status').eq('code',String(code||'').toUpperCase()).maybeSingle())}
async function getContexts(user,app){
 if(!user||user.status!=='active'||!app||app.status!=='active')return [];
 // Platform administration does not imply a customer product identity.
 // Read candidate memberships/roles first; never fetch every tenant then filter.
 const [membershipResult,roleResult]=await Promise.all([
  db().from('organization_memberships').select('organization_id,user_id,status').eq('user_id',user.id).eq('status','active').limit(501),
  db().from('user_app_roles').select('organization_id,application_id,user_id,role_code').eq('user_id',user.id).eq('application_id',app.id).limit(501)
 ]);
 const memberships=check(membershipResult),roles=check(roleResult);
 if(memberships.length>500||roles.length>500)throw new Error('Workspace count exceeds supported context limit.');
 const memberIds=new Set(memberships.map(m=>m.organization_id));
 const ids=[...new Set(roles.filter(r=>memberIds.has(r.organization_id)).map(r=>r.organization_id))];
 if(!ids.length)return [];
 const contexts=[];
 // Bound PostgREST URL sizes as well as returned row counts.
 for(let offset=0;offset<ids.length;offset+=50){
  const batch=ids.slice(offset,offset+50);
  const [subscriptions,grants,organizations]=await Promise.all([
   db().from('subscriptions').select('organization_id,application_id,status,starts_at,ends_at').eq('application_id',app.id).in('organization_id',batch),
   db().from('organization_app_access').select('organization_id,application_id,status').eq('application_id',app.id).in('organization_id',batch),
   db().from('organizations').select('id,name,slug,status').in('id',batch).eq('status','active')
  ]);
  contexts.push(...permittedContexts({user,app,organizations:check(organizations),subscriptions:check(subscriptions),grants:check(grants),memberships,roles}));
 }
 return contexts;
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

