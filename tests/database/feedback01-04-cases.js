const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async pool=>{
  const owner=randomUUID(),staff=randomUUID(),stranger=randomUUID();
  for(const [id,name,role] of [[owner,'Feedback owner','super_admin'],[staff,'Feedback engineer','user'],[stranger,'Unrelated user','user']]){
    await pool.query('insert into auth.users(id) values($1)',[id]);
    await pool.query('insert into profiles(id,full_name,email,platform_role) values($1,$2,$3,$4)',
      [id,name,id+'@fixture.test',role]);
  }
  const pc=async(action,id,data={},actor=owner)=>
    (await pool.query('select project_command($1,$2,$3,$4) data',[actor,action,id,data])).rows[0].data;
  const creation=async(action,data={},actor=owner)=>
    (await pool.query('select project_creation_command($1,$2,$3) data',[actor,action,data])).rows[0].data;
  const lifecycle=async(action,id,data={},actor=owner)=>
    (await pool.query('select project_lifecycle_command($1,$2,$3,$4) data',[actor,action,id,data])).rows[0].data;
  const rehire=async(action,id=null,data={},actor=owner)=>
    (await pool.query('select internal_employee_rehire_command($1,$2,$3,$4) data',[actor,action,id,data])).rows[0].data;
  const createEmployee=async email=>
    (await pool.query("select internal_employee_command($1,'create',$2,$3) data",[
      owner,randomUUID(),{fullName:'Feedback engineer',email,department:'Engineering',jobTitle:'Developer',
      employmentType:'full_time',startDate:'2026-11-09'}])).rows[0].data;

  const employee=await createEmployee(staff+'@fixture.test');
  const active=await pool.query("select internal_employee_command($1,'update',$2,$3) data",[
    owner,employee.id,{version:employee.version,confirmed:true,fullName:'Feedback engineer',department:'Engineering',
     jobTitle:'Developer',employmentType:'full_time',startDate:'2026-11-09',status:'active'}
  ]);
  await require('./employee-link-fixture')(pool,owner,staff,employee.id);

  const candidates=await creation('managers');
  assert.ok(candidates.managers.some(x=>x.id===staff));
  await assert.rejects(creation('managers',{},stranger),{code:'42501'});
  await assert.rejects(creation('create',{key:'BADMANAGER',name:'Denied',kind:'internal',managerUserId:stranger}),{code:'42501'});
  assert.equal((await pool.query("select count(*) from projects where key='BADMANAGER'")).rows[0].count,'0');

  const project=await creation('create',{
    key:'FB-NEW-MANAGER',name:'Feedback project with manager',kind:'internal',managerUserId:staff
  });
  const manager=await pool.query("select role,status from project_memberships where project_id=$1 and user_id=$2",[project.id,staff]);
  assert.equal(manager.rows[0].role,'manager');
  assert.equal(manager.rows[0].status,'active');
  assert.ok(project.version>1,'manager appointment updates the project version atomically');
  assert.equal((await pool.query("select count(*) from audit_logs where action='project.created' and target_id=$1",[project.id])).rows[0].count,'1');
  const createdWithoutManager=await creation('create',{
    key:'FB-EMPTY-DELETE',name:'Disposable empty project',kind:'internal',managerUserId:''
  });
  await assert.rejects(lifecycle('delete',createdWithoutManager.id,{
    version:createdWithoutManager.version,key:createdWithoutManager.key,confirmed:true
  }),{code:'22023'});
  await assert.rejects(lifecycle('archive',createdWithoutManager.id,{
    version:createdWithoutManager.version,key:'WRONG',confirmed:true
  }),{code:'22023'});
  await assert.rejects(lifecycle('archive',createdWithoutManager.id,{
    version:createdWithoutManager.version,key:createdWithoutManager.key,confirmed:true
  },stranger),{code:'42501'});
  await lifecycle('archive',createdWithoutManager.id,{
    version:createdWithoutManager.version,key:createdWithoutManager.key,confirmed:true
  });
  let row=(await pool.query("select status,version from projects where id=$1",[createdWithoutManager.id])).rows[0];
  assert.equal(row.status,'archived');
  await lifecycle('delete',createdWithoutManager.id,{
    version:row.version,key:createdWithoutManager.key,confirmed:true
  });
  assert.equal((await pool.query('select count(*) from projects where id=$1',[createdWithoutManager.id])).rows[0].count,'0');
  assert.equal((await pool.query("select count(*) from audit_logs where action='project.permanently_deleted' and target_id=$1",[createdWithoutManager.id])).rows[0].count,'1');

  const retained=await pc('create',null,{key:'FB-RETAIN-DELIVERY',name:'Retained project',kind:'internal'});
  await pc('milestone.create',retained.id,{version:retained.version,title:'Keep milestone'});
  await lifecycle('archive',retained.id,{version:retained.version+1,key:retained.key,confirmed:true});
  row=(await pool.query('select status,version from projects where id=$1',[retained.id])).rows[0];
  await assert.rejects(lifecycle('delete',retained.id,{
    version:row.version,key:retained.key,confirmed:true
  }),{code:'23503'});
  assert.equal((await pool.query('select count(*) from project_milestones where project_id=$1',[retained.id])).rows[0].count,'1');

  // Removal is a soft delete. A restoration uses the same unique email and ID,
  // preserves prior removal history, and never silently reinstates permissions.
  const version=(await pool.query('select version from internal_employees where id=$1',[employee.id])).rows[0].version;
  await pool.query("select internal_employee_removal($1,'remove',$2,$3)",[
    owner,employee.id,{version,confirmed:true,reason:'Synthetic employment concluded'}
  ]);
  const archived=(await pool.query('select version,status,removed_at from internal_employees where id=$1',[employee.id])).rows[0];
  assert.equal(archived.status,'inactive');
  assert.ok(archived.removed_at);
  await assert.rejects(pool.query("update internal_employees set updated_at=now() where id=$1",[employee.id]),{code:'42501'},
    'owner-only restore guard must fail closed when GUC is absent');
  await assert.rejects(rehire('list',null,{},stranger),{code:'42501'});
  const found=await rehire('lookup',null,{email:staff+'@fixture.test'});
  assert.equal(found.employee.archived,true);
  assert.equal(found.employee.id,employee.id);
  assert.ok((await rehire('list')).employees.some(x=>x.id===employee.id));
  await assert.rejects(rehire('restore',employee.id,{
    version:archived.version,confirmed:true,reason:'Return to workforce'
  },stranger),{code:'42501'});
  await assert.rejects(rehire('restore',employee.id,{
    version:archived.version-1,confirmed:true,reason:'Return to workforce'
  }),{code:'40001'});
  const restored=await rehire('restore',employee.id,{
    version:archived.version,confirmed:true,reason:'Return to workforce'
  });
  assert.equal(restored.status,'onboarding');
  assert.equal(restored.requiresNewConsent,true);
  const after=(await pool.query('select version,status,removed_at,removed_by from internal_employees where id=$1',[employee.id])).rows[0];
  assert.equal(after.status,'onboarding');
  assert.equal(after.removed_at,null);
  assert.equal(after.removed_by,null);
  assert.equal(after.version,archived.version+1);
  assert.equal((await pool.query("select count(*) from internal_employee_restoration_events where employee_id=$1",[employee.id])).rows[0].count,'1');
  assert.equal((await pool.query("select count(*) from audit_logs where target_id=$1 and action='employee.restored'",[employee.id])).rows[0].count,'1');
  assert.equal((await pool.query("select status from internal_employee_identity_links where employee_id=$1",[employee.id])).rows[0].status,'revoked');
  assert.equal((await pool.query('select status from project_memberships where project_id=$1 and user_id=$2',[project.id,staff])).rows[0].status,'revoked');
  await assert.rejects(rehire('restore',employee.id,{
    version:after.version,confirmed:true,reason:'Duplicate restore'
  }),{code:'P0002'});

  for(const role of ['anon','authenticated']){
    const client=await pool.connect();
    try{
      await client.query('set role '+role);
      await assert.rejects(client.query('select * from internal_employee_restoration_events'),{code:'42501'});
      await assert.rejects(client.query("select project_creation_command($1,'managers','{}')",[owner]),{code:'42501'});
      await assert.rejects(client.query("select project_lifecycle_command($1,'archive',$2,'{}')",[owner,retained.id]),{code:'42501'});
      await assert.rejects(client.query("select internal_employee_rehire_command($1,'list',null,'{}')",[owner]),{code:'42501'});
    }finally{await client.query('reset role');client.release();}
  }
};
