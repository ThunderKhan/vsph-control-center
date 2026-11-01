const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {once}=require('node:events');
const crypto=require('node:crypto');
const fs=require('node:fs');
const {securityHeaders,trustProxy,rateLimit,safeError}=require('../http-security');
async function run(app,fn){const server=app.listen(0,'127.0.0.1');try{await once(server,'listening');await fn('http://127.0.0.1:'+server.address().port)}finally{await new Promise(r=>server.close(r))}}
test('proxy trust is explicit and refuses hop counts / blanket trust',()=>{
 assert.equal(trustProxy(''),false);assert.deepEqual(trustProxy('loopback,10.0.0.0/8'),['loopback','10.0.0.0/8']);
 for(const value of ['true','1','false',' 2 '])assert.throws(()=>trustProxy(value),/TRUST_PROXY/);
});
test('headers protect login and all API errors; CSP permits only reviewed inline prepaint',async()=>{
 const app=require('../server');await run(app,async origin=>{
  for(const route of ['/login','/api/auth/me','/api/workspaces']){
   const r=await fetch(origin+route);assert.equal(r.headers.get('x-frame-options'),'DENY');
   assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
   assert.match(r.headers.get('x-request-id'),/^[0-9a-f-]{36}$/);
   const csp=r.headers.get('content-security-policy');assert.match(csp,/frame-ancestors 'none'/);
   const inline=fs.readFileSync('public/dashboard.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
   assert.ok(csp.includes('sha256-'+crypto.createHash('sha256').update(inline).digest('base64')));
   assert.doesNotMatch(csp.split(';').find(s=>s.trim().startsWith('script-src')),/unsafe-inline|unsafe-eval/);
   if(route.startsWith('/api'))assert.equal(r.headers.get('cache-control'),'no-store');
  }
 });
});
test('throttle counts concurrent requests, ignores spoofed forwarding and resets window',async()=>{
 let time=1000;const app=express();app.use(rateLimit({limit:3,windowMs:1000,now:()=>time}));app.post('/',(req,res)=>res.sendStatus(204));
 await run(app,async origin=>{
  const replies=await Promise.all(Array.from({length:6},(_,i)=>fetch(origin,{method:'POST',headers:{'X-Forwarded-For':'192.0.2.'+i}})));
  assert.equal(replies.filter(r=>r.status===204).length,3);assert.equal(replies.filter(r=>r.status===429).length,3);
  assert.equal(replies.find(r=>r.status===429).headers.get('retry-after'),'1');
  time+=1001;assert.equal((await fetch(origin,{method:'POST'})).status,204);
 });
});
test('bounded rate limiter fails closed on new-key saturation',()=>{
 const limiter=rateLimit({limit:1,windowMs:1000,maxKeys:1,now:()=>1});
 const res={set(){},status(s){this.code=s;return this},json(){}};
 limiter({ip:'one'},res,()=>{});limiter({ip:'two'},res,()=>assert.fail('must not admit'));
 assert.equal(res.code,429);
});
test('malformed and oversized JSON return safe 400/413 without exception details',async()=>{
 const app=express();app.use(securityHeaders,express.json({limit:'1kb'}));app.post('/api/write',()=>{throw Error('secret-token-should-never-leak')});app.use(safeError);
 await run(app,async origin=>{
  for(const [body,status] of [['{',400],[JSON.stringify({data:'x'.repeat(2000)}),413],['{}',500]]){
   const r=await fetch(origin+'/api/write',{method:'POST',headers:{'Content-Type':'application/json'},body});
   assert.equal(r.status,status);const text=await r.text();assert.doesNotMatch(text,/secret-token|SyntaxError|stack/);assert.match(text,/requestId/);
  }
 });
});

test('missing schema errors fail closed with actionable 503 and no database details',async()=>{const app=express();app.use(securityHeaders);app.get('/api/schema',(req,res,next)=>next(Object.assign(Error('private SQL and credential-like material'),{code:'42703'})));app.use(safeError);await run(app,async origin=>{const r=await fetch(origin+'/api/schema');assert.equal(r.status,503);const d=await r.json();assert.equal(d.code,'SCHEMA_NOT_READY');assert.doesNotMatch(JSON.stringify(d),/private SQL|credential-like/);assert.equal(d.requestId,r.headers.get('x-request-id'));});});
