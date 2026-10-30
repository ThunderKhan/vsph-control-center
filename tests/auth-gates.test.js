const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {hashToken,appCookie} = require('../tokens');

// Import the real access-control middleware with an in-memory Supabase substitute.
// No network, credentials or real customer data is involved.
function withSecurity(rows = {}) {
  const securityPath = require.resolve('../security');
  const dbPath = require.resolve('../db');
  const previousSecurity = require.cache[securityPath];
  const previousDb = require.cache[dbPath];
  const check = result => {
    if (result.error) throw result.error;
    return result.data;
  };
  const makeQuery = table => {
    const filters = [];
    const result = () => {
      const records = rows[table];
      if (records == null) return [];
      return (Array.isArray(records) ? records : [records])
        .filter(record => filters.every(([column, value]) => Array.isArray(value) ? value.includes(record[column]) : record[column] === value));
    };
    return {
      select() { return this; },
      limit() { return this; },
      in(column, value) { filters.push([column, value]); return this; },
      eq(column, value) { filters.push([column, value]); return this; },
      maybeSingle() { return Promise.resolve({data: result()[0] ?? null, error: null}); },
      then(fulfill, reject) {
        return Promise.resolve({data: result(), error: null}).then(fulfill, reject);
      }
    };
  };
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {db: () => ({from: makeQuery}), check}
  };
  delete require.cache[securityPath];
  try { return require('../security'); }
  finally {
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousSecurity) require.cache[securityPath] = previousSecurity;
    else delete require.cache[securityPath];
  }
}

function request(originalUrl, cookies = {}) {
  return {originalUrl, method: 'GET', cookies, params: {app:'music'}};
}
function response() {
  return {
    statusCode: 200, location: null, body: null,
    status(code) { this.statusCode = code; return this; },
    redirect(code, location) { this.statusCode = code; this.location = location; return this; },
    json(body) { this.body = body; return this; }
  };
}
const future = () => new Date(Date.now()+60_000).toISOString();
const past = () => new Date(Date.now()-60_000).toISOString();
const rows = (expired=false) => ({
  portal_sessions: {token_hash:hashToken('portal-token'),user_id:'user-a',expires_at:expired?past():future()},
  profiles: {id:'user-a',full_name:'User A',email:'a@example.test',status:'active',platform_role:'super_admin'},
  app_sessions: {token_hash:hashToken('app-token'),user_id:'user-a',portal_token_hash:hashToken('portal-token'),application_id:'app-music',organization_id:'tenant-a',expires_at:future()},
  applications: {id:'app-music',code:'MUSIC',name:'Music',status:'active'},
  organization_memberships: [{organization_id:'tenant-a',user_id:'user-a',status:'active'}],
  user_app_roles: [{organization_id:'tenant-a',application_id:'app-music',user_id:'user-a',role_code:'staff'}],
  organizations: [{id:'tenant-a',name:'Venue A',status:'active'}],
  subscriptions: [{organization_id:'tenant-a',application_id:'app-music',status:'active',ends_at:null}],
  organization_app_access: [{organization_id:'tenant-a',application_id:'app-music',status:'enabled'}]
});

test('typing Music URL with no portal cookie redirects to central login', async () => {
  const {portalSession} = withSecurity();
  for (const url of ['/apps/music/login', '/apps/music/home', '/dashboard.html']) {
    const res = response();
    await portalSession(request(url),res,() => assert.fail('must not authorize anonymous user'));
    assert.equal(res.statusCode,302);
    assert.equal(res.location,'/login');
  }
});

test('API with no portal cookie returns JSON 401, not an HTML redirect', async () => {
  const {portalSession} = withSecurity();
  const res = response();
  await portalSession(request('/api/apps/MUSIC/records'),res,()=>assert.fail('must not authorize'));
  assert.equal(res.statusCode,401);
  assert.match(res.body.message,/log in/i);
  assert.equal(res.location,null);
});

test('expired portal session also redirects HTML visitors to central login', async () => {
  const {portalSession} = withSecurity(rows(true));
  const res = response();
  await portalSession(request('/apps/music/login',{'vsph.portal.sid':'portal-token'}),res,()=>assert.fail('expired session must fail'));
  assert.equal(res.statusCode,302);
  assert.equal(res.location,'/login');
});

test('valid portal session is required but not sufficient for Music workspace', async () => {
  const {portalSession,requireApp} = withSecurity(rows());
  const req = request('/apps/music/home',{'vsph.portal.sid':'portal-token'});
  const res = response();
  let portalGranted = false;
  await portalSession(req,res,()=>{portalGranted=true;});
  assert.equal(portalGranted,true);
  let appGranted = false;
  await requireApp(req,res,()=>{appGranted=true;});
  assert.equal(appGranted,false);
  assert.equal(res.statusCode,302);
  assert.equal(res.location,'/apps/music/login');
});

test('app API without app session still returns 401 JSON', async () => {
  const {portalSession,requireApp} = withSecurity(rows());
  const req = request('/api/apps/MUSIC/records',{'vsph.portal.sid':'portal-token'});
  const res = response();
  await portalSession(req,res,()=>{});
  await requireApp(req,res,()=>assert.fail('should require second login'));
  assert.equal(res.statusCode,401);
  assert.equal(res.location,null);
});

test('valid portal and app sessions plus tenant entitlement permit Music access', async () => {
  const {portalSession,requireApp} = withSecurity(rows());
  const req = request('/apps/music/home',{
    'vsph.portal.sid':'portal-token',[appCookie('MUSIC')]:'app-token'
  });
  const res = response();
  let granted = false;
  await portalSession(req,res,()=>{});
  await requireApp(req,res,()=>{granted=true;});
  assert.equal(granted,true);
  assert.equal(req.appContext.organization.id,'tenant-a');
  assert.equal(req.appContext.app.code,'MUSIC');
});

test('expired Music application session returns user to second login', async () => {
  const data = rows();
  data.app_sessions.expires_at = past();
  const {portalSession,requireApp} = withSecurity(data);
  const req = request('/apps/music/home',{
    'vsph.portal.sid':'portal-token',[appCookie('MUSIC')]:'app-token'
  });
  const res = response();
  await portalSession(req,res,()=>{});
  await requireApp(req,res,()=>assert.fail('expired app session must be denied'));
  assert.equal(res.statusCode,302);
  assert.equal(res.location,'/apps/music/login');
});

test('revoking tenant product access denies even previously authenticated app sessions', async () => {
  const data = rows();
  data.organization_app_access[0].status = 'revoked';
  const {portalSession,requireApp} = withSecurity(data);
  const req = request('/apps/music/home',{
    'vsph.portal.sid':'portal-token',[appCookie('MUSIC')]:'app-token'
  });
  const res = response();
  await portalSession(req,res,()=>{});
  await requireApp(req,res,()=>assert.fail('revoked app access must be denied'));
  assert.equal(res.statusCode,403);
});

test('public login allows an anonymous visitor without redirecting', async () => {
  const {optionalPortal} = withSecurity();
  const req=request('/login');
  const res=response();
  let continued=false;
  await optionalPortal(req,res,()=>{continued=true});
  assert.equal(continued,true);
  assert.equal(req.user,undefined);
  assert.equal(res.location,null);
});

test('public login recognizes an active portal cookie for a pre-render redirect', async () => {
  const {optionalPortal} = withSecurity(rows());
  const req=request('/login',{'vsph.portal.sid':'portal-token'});
  const res=response();
  let continued=false;
  await optionalPortal(req,res,()=>{continued=true});
  assert.equal(continued,true);
  assert.equal(req.user.id,'user-a');
  assert.equal(req.portalSession.user_id,'user-a');
  assert.equal(res.location,null);
});

test('expired, unknown and disabled cookies are treated as guests on the login route', async () => {
  const scenarios=[rows(true),rows(),rows()];
  scenarios[2].profiles.status='disabled';
  const cookies=['portal-token','unknown-token','portal-token'];
  for(let i=0;i<scenarios.length;i++){
    const {optionalPortal}=withSecurity(scenarios[i]);
    const req=request('/',{'vsph.portal.sid':cookies[i]});
    const res=response();
    let continued=false;
    await optionalPortal(req,res,()=>{continued=true});
    assert.equal(continued,true);
    assert.equal(req.user,undefined);
    assert.equal(res.location,null);
  }
});

