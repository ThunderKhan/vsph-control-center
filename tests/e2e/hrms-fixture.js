const {randomUUID}=require('node:crypto'),{hashToken}=require('../../tokens');
module.exports=async(pool,owner)=>{
 for(const layout of ['desktop','mobile']){
  const ids={};for(const role of ['staff','hr']){
   const user=randomUUID();ids[role]=user;await pool.query('insert into auth.users values($1)',[user]);await pool.query("insert into profiles(id,full_name,email) values($1,$2,$3)",[user,role+' '+layout,role+'-'+layout+'@fixture.test']);await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '2 hours')",[hashToken('fixture-hrms-'+role+'-'+layout),user]);
   const e=(await pool.query("select internal_employee_command($1,'create',$2,$3) d",[owner,randomUUID(),{fullName:role+' '+layout,email:role+'-'+layout+'@fixture.test',department:'Engineering',jobTitle:'Developer',employmentType:'full_time',startDate:'2026-11-01'}])).rows[0].d;
   await pool.query("update internal_employees set status='active' where id=$1",[e.id]);await require('../database/employee-link-fixture')(pool,owner,user,e.id);
   if(role==='hr'){await pool.query('insert into internal_hr_managers(employee_id,user_id,granted_by) values($1,$2,$3)',[e.id,user,owner]);}
  }
  const p=(await pool.query("select project_command($1,'create',null,$2) d",[owner,{key:'HRMS-'+layout.toUpperCase(),name:'Assigned delivery '+layout,kind:'internal'}])).rows[0].d;
  await pool.query("insert into project_memberships(project_id,user_id,role) values($1,$2,'contributor')",[p.id,ids.staff]);
  await pool.query("select project_command($1,'task.create',$2,$3)",[owner,p.id,{version:1,title:'Implement assigned feature '+layout,assigneeId:ids.staff}]);
  const completed=(await pool.query("select project_command($1,'task.create',$2,$3) d",[owner,p.id,{version:2,title:'Completed delivery '+layout,assigneeId:ids.staff}])).rows[0].d;
  await pool.query("update project_tasks set status='done' where id=$1",[completed.id]);
  await pool.query("insert into audit_logs(actor_user_id,action,target_type,target_id,details) values($1,'employee.task_status','project_task',$2,$3)",[ids.staff,completed.id,{from:'in_review',to:'done'}]);
  await pool.query("update projects set status='active' where id=$1",[p.id]);
 }
};
