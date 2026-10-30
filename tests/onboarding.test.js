const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const express=require('express');
const {once}=require('node:events');

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const crm='11111111-1111-4111-8111-111111111111';
const music='22222222-2222-4222-8222-222222222222';
const invitedId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const state={
  applications:[{id:crm,code:'CRM',name:'CRM',status:'active'},{id:music,code:'MUSIC',name:'Music',status:'active'}],
  organizations:[],profiles:[],organization_memberships:[],subscriptions:[],
  organization_app_access:[],user_app_roles:[],audit_logs:[],invites:[],
  failInvite:false,failSubscription:false,updatedPassword:null
};
function reset(){
  for(const key of ['organizations','profiles','organization_memberships','subscriptions',
    'organization_app_access','user_app_roles','audit_logs','invites'])state[key]=[];
  state.failInvite=false;state.failSubscription=false;state.updatedPassword=null;
}
function query(table){
  const matches=[],q={mode:'select',row:null,payload:null};
  const records=()=>state[table];
  const filtered=()=>records().filter(record=>matches.every(([k,v])=>Array.isArray(v)?v.includes(record[k]):record[k]===v));
  const execute=()=>{
    if(q.mode==='insert'){
      if(table==='subscriptions' && state.failSubscription)return {data:null,error:new Error('Simulated database failure')};
      const objects=(Array.isArray(q.payload)?q.payload:[q.payload]).map(obj=>({...obj,
        ...(table==='organizations'&&!obj.id?{id:crypto.randomUUID()}: {})}));
      records().push(...objects);
      return {data:Array.isArray(q.payload)?objects:objects[0],error:null};
    }
    if(q.mode==='delete'){
      const removed=filtered();
      state[table]=records().filter(row=>!removed.includes(row));
      return {data:removed,error:null};
    }
    if(q.mode==='update'){
      const changed=filtered();
      changed.forEach(row=>Object.assign(row,q.payload));
      return {data:changed,error:null};
    }
    return {data:filtered(),error:null};
  };
  const api={
    select(){return this},
    eq(field,value){matches.push([field,value]);return this},
    in(field,values){matches.push([field,values]);return this},
    insert(values){q.mode='insert';q.payload=values;return this},
    update(values){q.mode='update';q.payload=values;return this},
    delete(){q.mode='delete';return this},
    single(){const v=execute();return Promise.resolve({data:Array.isArray(v.data)?v.data[0]??null:v.data,error:v.error})},
    maybeSingle(){const v=execute();return Promise.resolve({data:Array.isArray(v.data)?v.data[0]??null:v.data,error:v.error})},
    then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)}
  };
  return api;
}
const fakeDb=()=>({
  from:query,
  auth:{
    admin:{
      inviteUserByEmail:async(email,options)=>{
        state.invites.push({email,options});
        return state.failInvite?{data:null,error:new Error('Unable to deliver invitation')}:
          {data:{user:{id:invitedId}},error:null};
      },
      deleteUser:async id=>({data:{user:{id}},error:null}),
      updateUserById:async(id,payload)=>{state.updatedPassword=payload.password;return {data:{user:{id}},error:null}}
    },
    getUser:async token=>token==='good-invite-token'?{data:{user:{id:invitedId}},error:null}:
      {data:null,error:new Error('Invalid invite')}
  }
});
const dbPath=require.resolve('../db'),prior=require.cache[dbPath];
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{
  db:fakeDb,check:({data,error})=>{if(error)throw error;return data}
}};
const {router:provision,validateOnboarding}=require('../routes/onboarding');
const invite=require('../routes/invitations');
if(prior)require.cache[dbPath]=prior;else delete require.cache[dbPath];
process.env.PUBLIC_ORIGIN='http://localhost:3000';
process.env.NODE_ENV='test';
const app=express();app.use(express.json());
app.use((req,res,next)=>{req.user={id:owner,platform_role:'super_admin'};next()});
app.use('/api/admin-management/onboardings',provision);
app.use('/api/invitations',invite);
app.use((error,req,res,next)=>res.status(500).json({message:error.message}));
async function withServer(fn){
  const server=app.listen(0,'127.0.0.1');
  try{await once(server,'listening');await fn('http://127.0.0.1:'+server.address().port)}
  finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
}
const payload=()=>({
 organizationName:'Northstar Hotels',slug:'northstar-hotels',adminName:'Mira Shah',adminEmail:'mira@example.test',
 products:[
  {applicationId:crm,planCode:'business',status:'trial',endsAt:new Date(Date.now()+14*86400000).toISOString()},
  {applicationId:music,planCode:'enterprise',status:'active',endsAt:null}
 ]
});
const post=(origin,route,body)=>fetch(origin+route,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
});
test('wizard rejects malformed tenant names, duplicate products, and expired trial',()=>{
  assert.throws(()=>validateOnboarding({...payload(),slug:'Bad Slug'}),/slug/);
  assert.throws(()=>validateOnboarding({...payload(),products:[]}),/Select/);
  assert.throws(()=>validateOnboarding({...payload(),products:[payload().products[0],payload().products[0]]}),/unique/);
  assert.throws(()=>validateOnboarding({...payload(),products:[{...payload().products[0],endsAt:null}]}),/Trial/);
  assert.throws(()=>validateOnboarding({...payload(),products:[{...payload().products[0],status:'cancelled'}]}),/trial or active/);
});
test('onboarding creates scoped grants and pending membership, then invite acceptance activates it',async()=>{
  reset();
  await withServer(async origin=>{
    const response=await post(origin,'/api/admin-management/onboardings',payload());
    assert.equal(response.status,201);
    assert.equal(state.organizations.length,1);
    assert.equal(state.profiles.length,1);
    assert.equal(state.organization_memberships[0].status,'invited');
    assert.equal(state.organization_memberships[0].role,'owner');
    assert.equal(state.user_app_roles.length,2);
    assert.ok(state.user_app_roles.every(role=>role.role_code==='super_admin'));
    assert.equal(state.subscriptions.length,2);
    assert.equal(state.organization_app_access.length,2);
    assert.ok(state.organization_app_access.every(access=>access.status==='enabled'));
    assert.equal(state.invites[0].email,'mira@example.test');
    assert.equal(state.invites[0].options.redirectTo,'http://localhost:3000/accept-invite');

    const invalid=await post(origin,'/api/invitations/accept',{accessToken:'invalid',password:'password-1234'});
    assert.equal(invalid.status,401);
    assert.equal(state.organization_memberships[0].status,'invited');
    const success=await post(origin,'/api/invitations/accept',{accessToken:'good-invite-token',password:'strong-password-123'});
    assert.equal(success.status,200);
    assert.equal(state.organization_memberships[0].status,'active');
    assert.equal(state.updatedPassword,'strong-password-123');
    const replay=await post(origin,'/api/invitations/accept',{accessToken:'good-invite-token',password:'another-password-123'});
    assert.equal(replay.status,403);
  });
});
test('duplicate organization slug or user email is rejected before sending an invitation',async()=>{
  reset();
  await withServer(async origin=>{
    let response=await post(origin,'/api/admin-management/onboardings',payload());
    assert.equal(response.status,201);
    response=await post(origin,'/api/admin-management/onboardings',payload());
    assert.equal(response.status,409);
    assert.equal(state.invites.length,1);
    const p={...payload(),slug:'different-org'};
    response=await post(origin,'/api/admin-management/onboardings',p);
    assert.equal(response.status,409);
    assert.equal(state.invites.length,1);
  });
});
test('failed invitation rolls back organization and does not provision unauthorized access',async()=>{
  reset();state.failInvite=true;
  await withServer(async origin=>{
    const response=await post(origin,'/api/admin-management/onboardings',payload());
    assert.equal(response.status,500);
    assert.equal(state.organizations.length,0);
    assert.equal(state.organization_memberships.length,0);
    assert.equal(state.user_app_roles.length,0);
  });
  state.failInvite=false;
});
test('disabled app in a product selection is rejected before creating customer',async()=>{
  reset();state.applications[1].status='maintenance';
  try{
    await withServer(async origin=>{
      const response=await post(origin,'/api/admin-management/onboardings',payload());
      assert.equal(response.status,400);
      assert.equal(state.organizations.length,0);
      assert.equal(state.invites.length,0);
    });
  }finally{state.applications[1].status='active'}
});
