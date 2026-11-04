const test = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {hashToken} = require('../tokens');

// Exercise actual Express routing with an in-memory session store, without
// connecting to Supabase or requiring the browser to render the login page.
const dbPath = require.resolve('../db');
const previousDb = require.cache[dbPath];
const future = new Date(Date.now()+60_000).toISOString();
const expired = new Date(Date.now()-60_000).toISOString();

const rows = {
  portal_sessions: [
    {token_hash:hashToken('live-portal'),user_id:'active-user',expires_at:future},
    {token_hash:hashToken('expired-portal'),user_id:'active-user',expires_at:expired},
    {token_hash:hashToken('disabled-portal'),user_id:'disabled-user',expires_at:future}
  ],
  profiles: [
    {id:'active-user',email:'active@example.test',full_name:'Active Member',platform_role:'user',status:'active'},
    {id:'disabled-user',email:'disabled@example.test',full_name:'Disabled Member',platform_role:'user',status:'disabled'}
  ]
};

function db() {
  return {
    from(table) {
      const filters=[];let fields;
      return {
        select(value) { fields=value;return this; },
        eq(field,value) { filters.push([field,value]); return this; },
        maybeSingle() {
          let data=(rows[table] || []).find(entry => filters.every(([key,value])=>entry[key]===value)) || null;
          if(data&&table==='portal_sessions'&&fields===require('../services/portal-session-fields').PORTAL_SESSION_FIELDS){const profile=rows.profiles.find(p=>p.id===data.user_id);data=profile?{...data,profile}:null;}
          return Promise.resolve({data,error:null});
        }
      };
    }
  };
}
require.cache[dbPath] = {
  id:dbPath,filename:dbPath,loaded:true,
  exports:{db,check:result=>{if(result.error)throw result.error;return result.data;},configured:()=>false,publicAuth:()=>{throw new Error('Auth not expected here');}}
};

const app = require('../server');
if(previousDb)require.cache[dbPath]=previousDb;
else delete require.cache[dbPath];

test('root and login redirect active portal sessions before serving HTML', async () => {
  const server=app.listen(0,'127.0.0.1');
  try {
    await once(server,'listening');
    const origin='http://127.0.0.1:'+server.address().port;
    const get=(pathname,cookie)=>
      fetch(origin+pathname,{redirect:'manual',headers:cookie?{Cookie:'vsph.portal.sid='+cookie}:{}});

    for(const pathname of ['/','/login','/login/']){
      // Express accepts a trailing slash, but never serves HTML to valid users.
      const response=await get(pathname,'live-portal');
      assert.equal(response.status,302,pathname);
      assert.equal(response.headers.get('location'),'/dashboard',pathname);
      assert.match(response.headers.get('cache-control')||'',/no-store/);
      const body=await response.text();
      assert.ok(!body.includes('id="authForm"'),pathname+' leaked the login form');
    }

    // Existing bookmarks still normalize without exposing a login form.
    const legacy=await get('/login.html','live-portal');
    assert.equal(legacy.status,302);
    assert.equal(legacy.headers.get('location'),'/login');

    for(const pathname of ['/','/login']){
      const response=await get(pathname);
      assert.equal(response.status,200,pathname);
      assert.match(await response.text(),/id="authForm"/);
      assert.match(response.headers.get('cache-control')||'',/no-store/);
    }

    for(const cookie of ['expired-portal','disabled-portal','unknown-token']){
      const response=await get('/login',cookie);
      assert.equal(response.status,200,cookie);
      assert.match(await response.text(),/id="authForm"/);
      assert.equal(response.headers.get('location'),null,cookie);
    }

    const me=await get('/api/auth/me','live-portal');
    assert.equal(me.status,200);
    assert.equal((await me.json()).user.id,'active-user');

    const invalid=await get('/api/auth/me','expired-portal');
    assert.equal(invalid.status,401);
    assert.equal(invalid.headers.get('content-type').includes('application/json'),true);
  } finally {
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
