const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const owner='44444444-4444-4444-8444-444444444444';
 const stranger='12121212-1111-4111-8111-111111111111';
 const worker=randomUUID();
 await pool.query('insert into auth.users(id) values($1)',[worker]);
 await pool.query('insert into profiles(id,full_name,email) values($1,$2,$3)',[worker,'Assigned engineer',worker+'@fixture.test']);
 const project=async(action,id,payload={},actor=owner)=>
   (await pool.query('select project_command($1,$2,$3,$4) data',[actor,action,id,payload])).rows[0].data;
 const workspace=async(action,id,payload={},actor=owner)=>
   (await pool.query('select project_workspace_command($1,$2,$3,$4) data',[actor,action,id,payload])).rows[0].data;

 const p=await project('create',null,{key:'WORKSPACE-V2',name:'Feedback 05 workspace',kind:'internal'});
 let version=p.version;
 await assert.rejects(workspace(null,p.id,{}),{code:'22023'});
 assert.equal((await pool.query('select version from projects where id=$1',[p.id])).rows[0].version,version);
 await assert.rejects(workspace('list',p.id,{},stranger),{code:'42501'});
 await assert.rejects(workspace('risk.add',p.id,{version,title:'Unsafe',severity:'high'},stranger),{code:'42501'});
 const milestone=await project('milestone.create',p.id,{version,title:'Release readiness'});version++;
 await project('member.save',p.id,{version,userId:worker,role:'contributor',status:'active',team:'Engineering'});version++;
 await assert.rejects(workspace('checklist.add',p.id,{version,milestoneId:randomUUID(),title:'Wrong project',assigneeId:null}),{code:'22023'});
 const added=await workspace('checklist.add',p.id,{version,milestoneId:milestone.id,title:'Release candidate verified',assigneeId:worker});version++;
 assert.equal((await workspace('list',p.id)).checklist[0].completed,false);
 await assert.rejects(workspace('checklist.toggle',p.id,{version,itemId:added.id,completed:true},stranger),{code:'42501'});
 const checked=await workspace('checklist.toggle',p.id,{version,itemId:added.id,completed:true},worker);version++;
 assert.equal(checked.version,version);
 assert.equal((await workspace('list',p.id)).checklist[0].completed_by,worker);
 assert.equal((await pool.query('select status from project_milestones where id=$1',[milestone.id])).rows[0].status,'planned','checklist completion must not auto-complete milestone');
 await assert.rejects(workspace('checklist.toggle',p.id,{version:version-1,itemId:added.id,completed:false}),{code:'40001'});
 await workspace('checklist.toggle',p.id,{version,itemId:added.id,completed:false});version++;
 assert.equal((await workspace('list',p.id)).checklist[0].completed_at,null);

 const risk=await workspace('risk.add',p.id,{version,title:'Deployment access pending',severity:'high'});version++;
 assert.equal((await workspace('list',p.id)).risks.find(x=>x.id===risk.id).status,'open');
 await assert.rejects(workspace('risk.resolve',p.id,{version,id:risk.id,resolved:true},worker),{code:'42501'});
 await workspace('risk.resolve',p.id,{version,id:risk.id,resolved:true});version++;
 assert.equal((await workspace('list',p.id)).risks.find(x=>x.id===risk.id).status,'resolved');
 await assert.rejects(workspace('resource.add',p.id,{version,label:'Bad',url:'javascript:alert(1)',category:'document',shared:false}),{code:'22023'});
 const resource=await workspace('resource.add',p.id,{version,label:'Design brief',url:'https://example.test/design',category:'design',shared:false});version++;
 assert.equal((await workspace('list',p.id)).resources[0].label,'Design brief');
 const update=await workspace('update.publish',p.id,{version,summary:'Planning and architecture completed',health:'on_track',nextSteps:'Begin development',shared:false});version++;
 assert.equal((await workspace('list',p.id)).updates[0].id,update.id);
 await workspace('resource.archive',p.id,{version,id:resource.id});version++;
 assert.equal((await workspace('list',p.id)).resources.length,0);

 const audit=(await pool.query("select count(*) n from audit_logs where target_id=$1 and action like 'project.workspace.%'",[p.id])).rows[0].n;
 assert.equal(Number(audit),8);
 // Client project visibility is per shared item; secret resources and updates are excluded.
 const customer='11111111-1111-4111-8111-111111111111';
 const org='22222222-2222-4222-8222-222222222222';
 await pool.query("update organization_memberships set status='active' where organization_id=$1 and user_id=$2",[org,customer]);
 const c=await project('create',null,{key:'WS-CLIENT',name:'Customer limited scope',kind:'customer',customerOrganizationId:org,clientVisible:true});
 await project('member.save',c.id,{version:1,userId:customer,role:'client',status:'active'});let cv=2;
 const safe=await workspace('resource.add',c.id,{version:cv,label:'Shared design',url:'https://example.test/shared',category:'design',shared:true});cv++;
 await workspace('resource.add',c.id,{version:cv,label:'Private design',url:'https://example.test/internal',category:'design',shared:false});cv++;
 await workspace('update.publish',c.id,{version:cv,summary:'Internal operational status notes',health:'at_risk',nextSteps:'Secret plan',shared:false});cv++;
 await workspace('update.publish',c.id,{version:cv,summary:'Public delivery status notes',health:'on_track',nextSteps:'Next release',shared:true});cv++;
 const clientData=await workspace('list',c.id,{},customer);
 assert.deepEqual(clientData.risks,[]);
 assert.deepEqual(clientData.resources.map(x=>x.id),[safe.id]);
 assert.equal(clientData.updates.length,1);
 assert.equal(clientData.updates[0].summary,'Public delivery status notes');
 assert.equal(clientData.canManage,false);
 await assert.rejects(workspace('resource.add',c.id,{version:cv,label:'Forbidden',url:'https://example.test/x',category:'other',shared:true},customer),{code:'42501'});
 await pool.query("update organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,customer]);
 await assert.rejects(workspace('list',c.id,{},customer),{code:'42501'});

 for(const role of ['anon','authenticated']) {
   const connection=await pool.connect();
   try {
     await connection.query('set role '+role);
     await assert.rejects(connection.query("select project_workspace_command($1,'list',$2,'{}')",[owner,p.id]),{code:'42501'});
     await assert.rejects(connection.query('select * from project_resources'),{code:'42501'});
   }finally{
     await connection.query('reset role');
     connection.release();
   }
 }
 await project('update',p.id,{version,status:'archived'});version++;
 await assert.rejects(workspace('risk.add',p.id,{version,title:'Forbidden after archive',severity:'high'}),{code:'22023'});
};
