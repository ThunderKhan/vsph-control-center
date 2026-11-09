const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
module.exports=async pool=>{
 const admin="44444444-4444-4444-8444-444444444444";
 const member=randomUUID(),outsider=randomUUID(),customer=randomUUID(),org=randomUUID();
 for(const u of [member,outsider,customer]){
  await pool.query("insert into auth.users(id) values($1)",[u]);
  await pool.query("insert into profiles(id,full_name,email) values($1,$2,$3)",[u,"Custom App "+u,u+"@fixture.test"]);
 }
 const call=async(actor,action,project,id=null,data={})=>
  (await pool.query("select public.project_custom_application_command($1,$2,$3,$4,$5) data",
  [actor,action,project,id,data])).rows[0].data;
 const appFields=(name,shared=false)=>({name,description:"Client delivery",status:"building",
  repositoryUrl:"https://github.com/example/repo",deploymentUrl:"",shared});
 const p=(await pool.query("select project_command($1,'create',null,$2) data",
  [admin,{key:"CUSTOM-"+randomUUID().slice(0,8).toUpperCase(),name:"Custom app test",kind:"internal"}])).rows[0].data;
 const first=await call(admin,"create",p.id,null,appFields("Internal custom"));
 assert.equal(first.name,"Internal custom");
 assert.equal(first.version,1);
 await assert.rejects(call(outsider,"list",p.id),{code:"42501"});
 await assert.rejects(call(outsider,"create",p.id,null,appFields("Foreign")),{code:"42501"});
 await pool.query("select project_command($1,'member.save',$2,$3)",
  [admin,p.id,{version:1,userId:member,role:"contributor",status:"active"}]);
 assert.equal((await call(member,"list",p.id)).applications.length,1);
 await assert.rejects(call(member,"create",p.id,null,appFields("Forbidden")),{code:"42501"});
 const updated=await call(admin,"update",p.id,first.id,{...appFields("Internal updated"),version:1});
 assert.equal(updated.version,2);
 await assert.rejects(call(admin,"update",p.id,first.id,{...appFields("Stale"),version:1}),{code:"40001"});
 const p2=(await pool.query("select project_command($1,'create',null,$2) data",
  [admin,{key:"FOREIGN-"+randomUUID().slice(0,8).toUpperCase(),name:"Second app project",kind:"internal"}])).rows[0].data;
 await assert.rejects(call(admin,"update",p2.id,first.id,{...appFields("Cross project"),version:2}),{code:"42501"});
 await pool.query("insert into public.organizations(id,name,slug) values($1,$2,$3)",[org,"Client app fixture","client-app-"+org.slice(0,8)]);
 await pool.query("insert into public.organization_memberships(organization_id,user_id,role,status) values($1,$2,'member','active')",[org,customer]);
 const cp=(await pool.query("select project_command($1,'create',null,$2) data",
  [admin,{key:"CUSTOMER-"+randomUUID().slice(0,8).toUpperCase(),name:"Client apps",kind:"customer",customerOrganizationId:org,clientVisible:true}])).rows[0].data;
 await pool.query("select project_command($1,'member.save',$2,$3)",
  [admin,cp.id,{version:1,userId:customer,role:"client",status:"active"}]);
 await call(admin,"create",cp.id,null,appFields("Private tenant app",false));
 const shared=await call(admin,"create",cp.id,null,appFields("Client-facing app",true));
 const visible=(await call(customer,"list",cp.id)).applications;
 assert.deepEqual(visible.map(a=>a.name),["Client-facing app"]);
 await assert.rejects(call(customer,"update",cp.id,shared.id,{...appFields("Claim",true),version:1}),{code:"42501"});
 await pool.query("update public.organization_memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,customer]);
 await assert.rejects(call(customer,"list",cp.id),{code:"42501"});
 const row=(await pool.query("select count(*)::int count from audit_logs where target_type='project_custom_application' and actor_user_id=$1",[admin])).rows[0];
 assert.ok(row.count>=4);
 const browser=await pool.connect();
 try{
  for(const role of ["anon","authenticated"]){
   await browser.query("set role "+role);
   await assert.rejects(browser.query("select * from public.project_custom_applications"),{code:"42501"});
   await assert.rejects(browser.query("select public.project_custom_application_command($1,'list',$2,null,'{}'::jsonb)",[admin,p.id]),{code:"42501"});
   await browser.query("reset role");
  }
 }finally{await browser.query("reset role");browser.release();}
};
