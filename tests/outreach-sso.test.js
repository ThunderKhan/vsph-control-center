const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {
  CLIENT_ID,APP_CODE,outreachConfig,B64URL,hash,pkce,verifySecret,
}=require('../integration/outreach-config');

const KEYS=['NODE_ENV','OUTREACH_SSO_START_URL','OUTREACH_SSO_CALLBACK_URL','OUTREACH_SSO_CLIENT_SECRET'];
function inEnv(values,fn){
  const prev=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));
  try{
    for(const key of KEYS)delete process.env[key];
    Object.assign(process.env,values);
    return fn();
  }finally{
    for(const key of KEYS){
      if(prev[key]===undefined)delete process.env[key];
      else process.env[key]=prev[key];
    }
  }
}
const secret='confidential-outreach-test-secret-is-not-for-production';
const valid={
  NODE_ENV:'production',
  OUTREACH_SSO_START_URL:'https://outreach.example.test/api/v1/sso/start',
  OUTREACH_SSO_CALLBACK_URL:'https://outreach.example.test/api/v1/sso/callback',
  OUTREACH_SSO_CLIENT_SECRET:secret,
};
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Outreach confidential SSO is disabled unless all three settings exist',()=>{
  assert.equal(inEnv({},outreachConfig),null);
  assert.throws(()=>inEnv({...valid,OUTREACH_SSO_CLIENT_SECRET:''},outreachConfig),/Incomplete/);
  assert.equal(inEnv(valid,outreachConfig).startUrl,valid.OUTREACH_SSO_START_URL);
  assert.equal(CLIENT_ID,'outreach-internal');
  assert.equal(APP_CODE,'OUTREACH');
});

test('Outreach redirect allowlist rejects unsafe endpoints and cross-origin callbacks',()=>{
  for(const start of [
    'http://outreach.example.test/api/v1/sso/start',
    'https://user:pass@outreach.example.test/api/v1/sso/start',
    'https://outreach.example.test/api/v1/sso/start?next=evil',
    'https://outreach.example.test/api/v1/sso/callback',
  ]) assert.throws(()=>inEnv({...valid,OUTREACH_SSO_START_URL:start},outreachConfig));
  assert.throws(()=>inEnv({...valid,
    OUTREACH_SSO_CALLBACK_URL:'https://different.example.test/api/v1/sso/callback'},outreachConfig));
});

test('PKCE and confidential client authentication are exact and constant-time',()=>{
  const verifier=crypto.randomBytes(32).toString('base64url');
  assert.ok(B64URL.test(verifier));
  assert.equal(pkce(verifier),crypto.createHash('sha256').update(verifier).digest('base64url'));
  assert.notEqual(hash(verifier),hash(verifier+'a'));
  assert.equal(verifySecret(secret,secret),true);
  assert.equal(verifySecret('invalid',secret),false);
  assert.equal(verifySecret(secret+'1',secret),false);
});

test('confidential backchannel precedes browser Origin middleware; no Music SSO changes',()=>{
  const server=src('server.js'),route=src('routes/outreach-sso.js');
  assert.ok(server.indexOf("app.post('/api/outreach-sso/exchange',outreachSso.exchange)")>
    server.indexOf("app.post('/api/sso/exchange',musicSso.exchange)"));
  assert.ok(server.indexOf("app.post('/api/outreach-sso/introspect',outreachSso.introspect)")<
    server.indexOf('app.use(validateOrigin)'));
  assert.ok(server.includes("app.use('/api/sso',musicSso.router)"));
  assert.match(route,/outreach_issue_code/);
  assert.match(route,/outreach_consume_code/);
  assert.match(route,/outreach_introspect/);
  assert.match(route,/outreach_access_command/);
  assert.ok(!route.includes('getContexts('),'Outreach must never rely on customer organization roles');
});

test('grant and code tables deny browser access; owner rights are explicit',()=>{
  const sql=src('supabase/migrations/20261111100000_outreach_internal_sso.sql');
  assert.match(sql,/create table public\.outreach_staff_grants/);
  assert.match(sql,/create table public\.outreach_launch_codes/);
  assert.match(sql,/portal_token_hash text not null references public\.portal_sessions/);
  assert.match(sql,/delete from public\.outreach_launch_codes/);
  assert.match(sql,/for share of p,g,s/);
  assert.match(sql,/internal_employee_identity_links/);
  assert.match(sql,/g\.status='enabled'/);
  assert.match(sql,/platform_role='super_admin'/);
  assert.match(sql,/revoke all on public\.outreach_launch_codes from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.outreach_consume_code/);
  assert.match(sql,/grant execute on function public\.outreach_access_command/);
});

test('Outreach navigation is server-guarded, not merely a hidden card',()=>{
  const server=src('server.js'),apps=src('routes/apps.js'),dashboard=src('public/dashboard.js');
  assert.match(server,/application\.code==='OUTREACH'/);
  assert.match(server,/outreachSso\.access\(req\)/);
  assert.match(apps,/if\(app\.code==='OUTREACH'\)/);
  assert.match(dashboard,/OUTREACH:/);
  assert.match(dashboard,/Internal employee workspace/);
});
