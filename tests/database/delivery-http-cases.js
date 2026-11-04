const assert=require('node:assert/strict');const {once}=require('node:events');const {hashToken}=require('../../tokens');
module.exports=async pool=>{
 const user='12121212-1111-4111-8111-111111111111',admin='44444444-4444-4444-8444-444444444444';
 await pool.query("insert into portal_sessions(token_hash,user_id,expires_at)values($1,$2,now()+interval '1 hour')",[hashToken('delivery-http'),user]);
 const app=require('./http-fixture')(pool),server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const headers={cookie:'vsph.portal.sid=delivery-http',Origin:'http://localhost:3000','Content-Type':'application/json'};
 try{
 const p=(await pool.query("select id from projects where key='DELIVERY'")).rows[0];
 assert.equal((await fetch(base+'/api/projects/'+p.id+'/delivery')).status,401);
 assert.equal((await fetch(base+'/api/project-reports/export.csv')).status,401);
 const denied=await fetch(base+'/api/projects/'+p.id+'/delivery',{headers});assert.equal(denied.status,403);assert.ok(!(await denied.text()).includes('fixture/private'));
 const sync=await fetch(base+'/api/projects/'+p.id+'/delivery/connections/'+p.id+'/sync',{method:'POST',headers,body:JSON.stringify({version:1})});assert.equal(sync.status,403);
 assert.equal((await fetch(base+'/api/project-reports?from=2026-02-30',{headers})).status,400);
 assert.equal((await fetch(base+'/api/notifications/preferences',{method:'POST',headers,body:JSON.stringify({userId:admin,assignments:true,delivery:true,overdue:true})})).status,400);
 const client='11111111-1111-4111-8111-111111111111';await pool.query("insert into portal_sessions(token_hash,user_id,expires_at)values($1,$2,now()+interval '1 hour')",[hashToken('delivery-client-http'),client]);const customerHeaders={...headers,cookie:'vsph.portal.sid=delivery-client-http'};
 const org=(await pool.query("insert into organizations(name,slug)values('Delivery customer','delivery-customer')returning id")).rows[0].id;
 await pool.query('insert into organization_memberships(organization_id,user_id)values($1,$2)',[org,client]);
 const customer=(await pool.query("select project_command($1,'create',null,$2) data",[admin,{key:'DELIVERY-CLIENT',name:'Customer private engineering',kind:'customer',customerOrganizationId:org,clientVisible:true}])).rows[0].data;
 await pool.query("select project_command($1,'member.save',$2,$3)",[admin,customer.id,{version:1,userId:client,role:'client',status:'active'}]);
 assert.equal((await fetch(base+'/api/projects/'+customer.id,{headers:customerHeaders})).status,200);
 assert.equal((await fetch(base+'/api/projects/'+customer.id+'/delivery',{headers:customerHeaders})).status,403);
 const report=await fetch(base+'/api/project-reports?projectId='+customer.id,{headers:customerHeaders});assert.deepEqual((await report.json()).projects,[]);
 const csv=await fetch(base+'/api/project-reports/export.csv?projectId='+customer.id,{headers:customerHeaders});assert.equal(csv.status,200);assert.equal(csv.headers.get('cache-control'),'no-store');assert.match(csv.headers.get('content-disposition'),/attachment/);assert.equal(csv.headers.get('x-vsph-export-scope'),'first-100-authorized-matching-projects');assert.doesNotMatch(await csv.text(),/Customer private engineering|fixture\/private/);
 assert.equal((await fetch(base+'/api/project-reports/export.csv?from=2026-02-30',{headers:customerHeaders})).status,400);
 const permitted=(await pool.query("select project_command($1,'create',null,$2) data",[admin,{key:'CSV-HTTP',name:'=1+1',kind:'internal'}])).rows[0].data;
 await pool.query("select project_command($1,'member.save',$2,$3)",[admin,permitted.id,{version:1,userId:user,role:'contributor',status:'active'}]);
 const exportUrl=base+'/api/project-reports/export.csv?projectId='+permitted.id;
 assert.match(await (await fetch(exportUrl,{headers})).text(),/"'=1\+1"/);
 await pool.query("select project_command($1,'member.save',$2,$3)",[admin,permitted.id,{version:2,userId:user,role:'contributor',status:'revoked'}]);
 assert.doesNotMatch(await (await fetch(exportUrl,{headers})).text(),/CSV-HTTP|1\+1/);
 await pool.query("update portal_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[hashToken('delivery-http')]);
 assert.equal((await fetch(base+'/api/notifications',{headers})).status,401);
 assert.equal((await fetch(base+'/api/project-reports/export.csv',{headers})).status,401);
 }finally{await new Promise(r=>server.close(r));}
};
