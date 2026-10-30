const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {CLIENT_ID,CODE_TTL_MS,musicConfig,hash,challenge,isB64Url,verifySecret}=require('../integration/sso-config');

function withEnv(vars,fn){
  const keys=['MUSIC_SSO_START_URL','MUSIC_SSO_CALLBACK_URL','MUSIC_SSO_CLIENT_SECRET','NODE_ENV'];
  const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    for(const k of keys)delete process.env[k];
    Object.assign(process.env,vars);
    return fn();
  }finally{
    for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]}
  }
}

test('Music SSO is disabled safely until all confidential server settings exist',()=>{
  withEnv({},()=>assert.equal(musicConfig(),null));
  withEnv({MUSIC_SSO_START_URL:'https://music.example.test/api/sso/start'},()=>assert.throws(musicConfig,/Incomplete/));
  withEnv({MUSIC_SSO_START_URL:'https://music.example.test/api/sso/start',
    MUSIC_SSO_CALLBACK_URL:'https://music.example.test/api/sso/callback',
    MUSIC_SSO_CLIENT_SECRET:'short'},()=>assert.throws(musicConfig,/Incomplete/));
});
test('Music redirects are fixed, HTTPS-only and cannot contain credentials or query input',()=>{
  const secret='super-secret-application-client-secret-123';
  const good={MUSIC_SSO_START_URL:'https://music.example.test/api/sso/start',
    MUSIC_SSO_CALLBACK_URL:'https://music.example.test/api/sso/callback',MUSIC_SSO_CLIENT_SECRET:secret,NODE_ENV:'production'};
  withEnv(good,()=>{
    const conf=musicConfig();
    assert.equal(conf.clientId,CLIENT_ID);
    assert.equal(conf.startUrl,'https://music.example.test/api/sso/start');
    assert.equal(conf.callbackUrl,'https://music.example.test/api/sso/callback');
  });
  for(const start of ['http://music.example.test/api/sso/start',
    'https://person:pass@music.example.test/api/sso/start',
    'https://music.example.test/api/sso/start?target=https://evil.test']){
    withEnv({...good,MUSIC_SSO_START_URL:start},()=>assert.throws(musicConfig));
  }
  withEnv({...good,MUSIC_SSO_CALLBACK_URL:'https://another.example.test/api/sso/callback'},()=>assert.throws(musicConfig));
});
test('authorization codes are short-lived; PKCE uses SHA256 and base64url',()=>{
  assert.equal(CODE_TTL_MS,60000);
  const verifier=crypto.randomBytes(32).toString('base64url');
  assert.equal(isB64Url(verifier),true);
  assert.equal(challenge(verifier),crypto.createHash('sha256').update(verifier).digest('base64url'));
  assert.notEqual(challenge('different'+verifier),challenge(verifier));
  assert.notEqual(hash('abc'),hash('abd'));
  assert.equal(isB64Url('invalid'),false);
  assert.equal(isB64Url([verifier]),false);
});
test('client authentication compares fixed-length cryptographic hashes',()=>{
  const secret='confidential-secret-1234567890123456';
  assert.equal(verifySecret(secret,secret),true);
  assert.equal(verifySecret(secret+'x',secret),false);
  assert.equal(verifySecret('',secret),false);
  assert.equal(verifySecret(undefined,secret),false);
});
test('exchange is backend-only, atomically redeems code, and rechecks role and tenant',()=>{
  const routes=fs.readFileSync(path.join(__dirname,'..','routes','sso.js'),'utf8');
  const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const schema=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20261030_music_sso_launch_codes.sql'),'utf8');
  assert.ok(server.indexOf("app.post('/api/sso/exchange',musicSso.exchange)") < server.indexOf('app.use(validateOrigin)'));
  assert.match(routes,/consume_sso_launch_code/);
  assert.match(routes,/getContexts/);
  assert.match(routes,/code_challenge/);
  assert.match(routes,/verifySecret/);
  assert.match(routes,/expires_at/);
  assert.match(schema,/delete from public\.sso_launch_codes/);
  assert.match(schema,/where code_hash=p_code_hash and expires_at>now\(\)/);
  assert.match(schema,/revoke all on function public\.consume_sso_launch_code\(text\) from public, anon, authenticated/);
  assert.match(server,/app.get\('\/apps\/:app\/launch',portalSession/);
});
