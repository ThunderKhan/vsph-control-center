const test=require('node:test');
const assert=require('node:assert/strict');
const {validSubscription,permittedContexts}=require('../access-policy');
const app={id:'crm',status:'active'};
const organizations=[{id:'alpha',name:'Alpha',status:'active'},{id:'beta',name:'Beta',status:'active'}];
const subscriptions=organizations.map(o=>({organization_id:o.id,application_id:'crm',status:'active',ends_at:null}));
const grants=organizations.map(o=>({organization_id:o.id,application_id:'crm',status:'enabled'}));
const memberships=[{organization_id:'alpha',user_id:'rahul',status:'active'},{organization_id:'beta',user_id:'another',status:'active'}];
const roles=[{organization_id:'alpha',application_id:'crm',user_id:'rahul',role_code:'admin'},{organization_id:'beta',application_id:'crm',user_id:'another',role_code:'admin'}];
function evaluate(overrides={}){return permittedContexts({user:{id:'rahul',platform_role:'user',status:'active'},app,organizations,subscriptions,grants,memberships,roles,...overrides})}
test('customer admins cannot see another tenant',()=>assert.deepEqual(evaluate().map(x=>x.id),['alpha']));
test('subscription alone does not confer individual access',()=>assert.equal(evaluate({roles:[]}).length,0));
test('role alone does not bypass membership',()=>assert.equal(evaluate({memberships:[]}).length,0));
test('disabled application grant revokes access',()=>assert.equal(evaluate({grants:grants.map(g=>({...g,status:'revoked'}))}).length,0));
test('expired subscription revokes access',()=>assert.equal(evaluate({subscriptions:subscriptions.map(s=>({...s,ends_at:'2020-01-01T00:00:00Z'}))}).length,0));
test('inactive organization revokes access',()=>assert.equal(evaluate({organizations:organizations.map(o=>({...o,status:'suspended'}))}).length,0));
test('cross-product role does not grant CRM',()=>assert.equal(evaluate({roles:roles.map(r=>({...r,application_id:'music'}))}).length,0));
test('platform administration alone grants no product tenant access',()=>assert.deepEqual(evaluate({user:{id:'owner',platform_role:'super_admin',status:'active'}}),[]));
test('platform administrator with explicit membership receives only the assigned product role',()=>assert.deepEqual(evaluate({user:{id:'rahul',platform_role:'super_admin',status:'active'}}).map(x=>[x.id,x.role]),[['alpha','admin']]));
test('future subscription start, invited membership and disabled profile cannot authorize',()=>{
 assert.equal(evaluate({subscriptions:subscriptions.map(s=>({...s,starts_at:'2099-01-01T00:00:00Z'}))}).length,0);
 assert.equal(evaluate({memberships:memberships.map(m=>({...m,status:'invited'}))}).length,0);
 assert.equal(evaluate({user:{id:'rahul',status:'disabled'}}).length,0);
});
test('trial counts active until expiration',()=>{assert.equal(validSubscription({status:'trial',ends_at:null}),true);assert.equal(validSubscription({status:'past_due',ends_at:null}),false)});


test('product record writes use explicit per-product allowlists',()=>{
 const {canCreateRecord}=require('../access-policy');
 for(const role of ['viewer','musician','platform_super_admin','owner','unknown'])for(const app of ['CRM','MUSIC'])assert.equal(canCreateRecord(app,role),false);
 assert.equal(canCreateRecord('MUSIC','staff'),true);assert.equal(canCreateRecord('CRM','staff'),false);
 assert.equal(canCreateRecord('CRM','user'),true);assert.equal(canCreateRecord('OTHER','admin'),false);
});
