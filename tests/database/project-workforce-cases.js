const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{hashToken}=require('../../tokens');
module.exports=async pool=>{
 const owner='44444444-4444-4444-8444-444444444444',mgr=randomUUID(),worker=randomUUID(),outsider=randomUUID();
 const add=async(id,role)=>{
  await pool.query('insert into auth.users(id) values($1)',[id]);
  await pool.query('insert into profiles(id,full_name,email) values($1,$2,$3)',[id,role,id+'@fixture.test']);
 };
 for(const [id,role] of [[mgr,'Manager'],[worker,'Engineer'],[outsider,'Outsider']])await add(id,role);
 const employee=async(id,role)=>{
  const e=(await pool.query("select internal_employee_command($1,'create',$2,$3) d",[owner,randomUUID(),
   {fullName:role,email:id+'@fixture.test',department:'Engineering',jobTitle:'Engineer',employmentType:'full_time',startDate:'2026-11-01'}])).rows[0].d;
  await pool.query("update internal_employees set status='active' where id=$1",[e.id]);
  await require('./employee-link-fixture')(pool,owner,id,e.id);
  return e.id;
 };
 const mgrEmployee=await employee(mgr,'Manager');
 await employee(worker,'Engineer');
 const cmd=async(actor,action,id,data={})=>(await pool.query('select project_workforce_command($1,$2,$3,$4) d',[actor,action,id,data])).rows[0].d;
 const project=async(actor,action,id,data={})=>(await pool.query('select project_command($1,$2,$3,$4) d',[actor,action,id,data])).rows[0].d;
 const p=await project(owner,'create',null,{key:'WF-'+randomUUID().slice(0,8).toUpperCase(),name:'Workforce governance',kind:'internal'});
 let v=1;
 await assert.rejects(cmd(outsider,'directory',p.id),{code:'42501'});
 assert.ok((await cmd(owner,'directory',p.id)).staff.some(x=>x.user_id===worker));
 assert.ok(!(await cmd(owner,'directory',p.id)).staff.some(x=>x.user_id===outsider));
 await cmd(owner,'assign',p.id,{version:v,userId:mgr,role:'manager',team:'Engineering'});v++;
 assert.equal((await pool.query('select project_permission($1,$2) r',[mgr,p.id])).rows[0].r,'manager');
 await assert.rejects(cmd(mgr,'assign',p.id,{version:v,userId:worker,role:'manager',team:'Engineering'}),{code:'42501'});
 await assert.rejects(project(mgr,'member.save',p.id,{version:v,userId:worker,role:'manager',status:'active'}),{code:'42501'});
 await assert.rejects(project(mgr,'update',p.id,{version:v,ownerId:mgr}),{code:'42501'});
 await cmd(mgr,'assign',p.id,{version:v,userId:worker,role:'contributor',team:'Engineering'});v++;
 assert.equal((await pool.query('select project_permission($1,$2) r',[worker,p.id])).rows[0].r,null);
 await assert.rejects(project(worker,'detail',p.id),{code:'42501'});
 assert.equal((await pool.query('select count(*)::int n from internal_hr_managers where user_id=$1',[mgr])).rows[0].n,0);
 const task=await project(mgr,'task.create',p.id,{version:v,title:'Assigned work',assigneeId:worker});v++;
 const key=hashToken('wf-'+randomUUID());
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[key,worker]);
 const mine=(await pool.query("select internal_self_service($1,'get',null,$2) d",[worker,{currentHash:key}])).rows[0].d;
 assert.ok(mine.tasks.some(x=>x.id===task.id));
 await assert.rejects(cmd(mgr,'remove',p.id,{version:v,userId:worker}),{code:'22023'});
 await project(mgr,'task.update',p.id,{version:v,id:task.id,assigneeId:mgr});v++;
 await cmd(mgr,'remove',p.id,{version:v,userId:worker});v++;
 assert.equal((await pool.query('select status from project_memberships where project_id=$1 and user_id=$2',[p.id,worker])).rows[0].status,'revoked');
 await cmd(owner,'manager.revoke',p.id,{version:v,userId:mgr});v++;
 assert.equal((await pool.query('select project_permission($1,$2) r',[mgr,p.id])).rows[0].r,null);
 await assert.rejects(cmd(mgr,'assign',p.id,{version:v,userId:worker,role:'contributor',team:''}),{code:'42501'});
 assert.ok((await cmd(owner,'overview',null)).managers.some(x=>x.project_id===p.id&&x.accountable_owner));
 await assert.rejects(cmd(owner,'assign',p.id,{version:v,userId:outsider,role:'contributor',team:''}),{code:'42501'});
 for(const role of ['anon','authenticated']){
  const client=await pool.connect();try{
   await client.query('set role '+role);
   await assert.rejects(client.query("select project_workforce_command($1,'overview',null,'{}')",[owner]),{code:'42501'});
  }finally{await client.query('reset role');client.release();}
 }
 await pool.query("update internal_employees set status='inactive' where id=$1",[mgrEmployee]);
 assert.equal((await pool.query('select project_permission($1,$2) r',[mgr,p.id])).rows[0].r,null);
};
