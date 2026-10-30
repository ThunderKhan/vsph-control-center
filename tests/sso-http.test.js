const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const crypto=require('node:crypto');
const {once}=require('node:events');

const secret='a-server-only-confidential-client-secret-with-length-64';
process.env.MUSIC_SSO_START_URL='http://127.0.0.1:4173/api/sso/start';
process.env.MUSIC_SSO_CALLBACK_URL='http://127.0.0.1:4173/api/sso/callback';
process.env.MUSIC_SSO_CLIENT_SECRET=secret;
process.env.NODE_ENV='test';

const data={
  sessions:[{token_hash:'portal-hash',user_id:'user-one',expires_at:new Date(Date.now()+600_000).toISOString()}],
  users:[{id:'user-one',full_name:'Venue Admin',email:'admin@example.test',platform_role:'user',status:'active'}],
  orgs:[{id:'tenant-allowed',name:'Venue A',role:'manager'}],
  codes:new Map(),
  active:true
};
const db=()=>({
  from(table) {
    const filters=[];
    return {
      select(){return this;},
      eq(field,value){filters.push([field,value]);return this;},
      insert(row){data.codes.set(row.code_hash,row);return Promise.resolve({data:row,error:null});},
      maybeSingle(){
        const source=table==='portal_sessions'?data.sessions:table==='profiles'?data.users:[];
        return Promise.resolve({data:source.find(x=>filters.every(([field,value])=>x[field]===value))||null,error:null});
      }
    };
  },
  rpc(name,{p_code_hash}) {
    assert.equal(name,'consume_sso_launch_code');
    const row=data.codes.get(p_code_hash);
    if(row)data.codes.delete(p_code_hash);
    return Promise.resolve({data:row && new Date(row.expires_at).getTime()>Date.now()?[row]:[],error:null});
  }
});
const securityModule=require.resolve('../security'),dbModule=require.resolve('../db');
const previousSecurity=require.cache[securityModule],previousDb=require.cache[dbModule];
require.cache[dbModule]={id:dbModule,filename:dbModule,loaded:true,exports:{
  db,check:({data,error})=>{if(error)throw error;return data}
}};
require.cache[securityModule]={id:securityModule,filename:securityModule,loaded:true,exports:{
  newToken:()=>crypto.randomBytes(32).toString('base64url'),
  portalSession:(req,res,next)=>{req.user=data.users[0];req.portalSession=data.sessions[0];next();},
  getApp:async()=>({id:'app-music',code:'MUSIC',status:'active'}),
  getContexts:async()=>data.active?data.orgs:[]
}};
delete require.cache[require.resolve('../routes/sso')];
const {router,exchange}=require('../routes/sso');
if(previousSecurity)require.cache[securityModule]=previousSecurity;
else delete require.cache[securityModule];
if(previousDb)require.cache[dbModule]=previousDb;
else delete require.cache[dbModule];

const app=express();
app.use(express.json());
app.post('/api/sso/exchange',exchange);
app.use('/api/sso',router);
app.use((err,req,res,next)=>{res.status(500).json({message:String(err.message)})});

const baseVerifier=crypto.randomBytes(32).toString('base64url');
const validChallenge=crypto.createHash('sha256').update(baseVerifier).digest('base64url');
const state=crypto.randomBytes(32).toString('base64url');

async function withServer(fn){
  const server=app.listen(0,'127.0.0.1');
  try{await once(server,'listening');await fn('http://127.0.0.1:'+server.address().port)}
  finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
}
async function authorize(origin,org='tenant-allowed',challenge=validChallenge) {
  const url=new URL('/api/sso/authorize',origin);
  for(const [key,value] of Object.entries({
    client_id:'music-vercel',app:'MUSIC',organization_id:org,
    state,code_challenge:challenge,code_challenge_method:'S256'
  }))url.searchParams.set(key,value);
  return fetch(url,{redirect:'manual'});
}
async function redeem(origin,code,verifier=baseVerifier,header=secret){
  return fetch(origin+'/api/sso/exchange',{method:'POST',
    headers:{'Content-Type':'application/json','x-vsph-client-secret':header},
    body:JSON.stringify({client_id:'music-vercel',code,code_verifier:verifier})});
}

test('one-use code exchanges authenticated user, selected tenant and live role',async()=>{
  await withServer(async origin=>{
    data.active=true;
    const response=await authorize(origin);
    assert.equal(response.status,303);
    const callback=new URL(response.headers.get('location'));
    assert.equal(callback.origin,'http://127.0.0.1:4173');
    assert.equal(callback.pathname,'/api/sso/callback');
    assert.equal(callback.searchParams.get('state'),state);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    const code=callback.searchParams.get('code');
    assert.ok(!data.codes.has(code),'raw code must never be stored');
    const stored=data.codes.get(crypto.createHash('sha256').update(code).digest('hex'));
    assert.ok(stored);
    assert.equal(stored.organization_id,'tenant-allowed');
    const ok=await redeem(origin,code);
    assert.equal(ok.status,200);
    const payload=await ok.json();
    assert.equal(payload.application.code,'MUSIC');
    assert.equal(payload.organization.id,'tenant-allowed');
  });
});
test('cross-tenant authorization is rejected even with an active portal session',async()=>{
  await withServer(async origin=>{
    const response=await authorize(origin,'tenant-other');
    assert.equal(response.status,403);
  });
});
test('incorrect Music client secret cannot redeem a valid code',async()=>{
  await withServer(async origin=>{
    const callback=new URL((await authorize(origin)).headers.get('location'));
    const code=callback.searchParams.get('code');
    assert.equal((await redeem(origin,code,baseVerifier,'wrong-secret')).status,401);
    const response=await redeem(origin,code);
    assert.equal(response.status,200);
    const identity=await response.json();
    assert.equal(identity.organization.id,'tenant-allowed');
    assert.equal(identity.role,'manager');
    assert.equal(identity.user.id,'user-one');
    assert.equal((await redeem(origin,code)).status,401,'replay must fail');
  });
});
test('wrong PKCE verifier burns the code and a revoked tenant fails redemption',async()=>{
  await withServer(async origin=>{
    let callback=new URL((await authorize(origin)).headers.get('location'));
    let code=callback.searchParams.get('code');
    assert.equal((await redeem(origin,code,crypto.randomBytes(32).toString('base64url'))).status,401);
    assert.equal((await redeem(origin,code)).status,401);
    callback=new URL((await authorize(origin)).headers.get('location'));
    code=callback.searchParams.get('code');
    data.active=false;
    assert.equal((await redeem(origin,code)).status,403);
    data.active=true;
  });
});
