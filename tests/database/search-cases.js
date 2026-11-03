const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async pool=>{
 const admin='44444444-4444-4444-8444-444444444444',manager=randomUUID(),client=randomUUID(),outsider=randomUUID(),org=randomUUID(),other=randomUUID();
 for(const [id,email] of [[manager,'search-manager'],[client,'search-client'],[outsider,'search-outsider']]){
  await pool.query('insert into auth.users values($1)',[id]);await pool.query("insert into profiles(id,full_name,email) values($1,$2,$2||'@fixture.test')",[id,email]);
 }
 for(const id of [org,other])await pool.query("insert into organizations(id,name,slug) values($1,'Search tenant',$1::text)",[id]);
 for(const id of [client,outsider])await pool.query("insert into organization_memberships(organization_id,user_id,member_role,status) values($1,$2,'admin','active')",[org,id]);
 const command=async(action,id,data)=>(await pool.query('select project_command($1,$2,$3,$4) data',[admin,action,id,data])).rows[0].data;
 const p=await command('create',null,{key:'SEARCHFIX',name:'Searchfix delivery',kind:'customer',customerOrganizationId:org,ownerId:manager,clientVisible:true});
 const foreign=await command('create',null,{key:'SEARCHFOREIGN',name:'Searchfix foreign',kind:'customer',customerOrganizationId:other});
 await command('member.save',p.id,{version:1,userId:client,role:'client',status:'active'});
 await pool.query("insert into project_tasks(project_id,title,shared,assignee_id,due_on) select $1,'Searchfix task '||lpad(n::text,2,'0'),n%2=0,$2,'2026-11-15' from generate_series(1,55) n",[p.id,manager]);
 await pool.query("insert into project_tasks(project_id,title,shared) values($1,'Searchfix foreign private',true)",[foreign.id]);
 await pool.query("insert into project_tasks(project_id,title,description,shared) values($1,'Ordinary title','Description secret searchfixonly',true),($1,'Literal 50%_ complete','',true)",[p.id]);
 await pool.query("insert into project_milestones(project_id,title,shared) values($1,'Searchfix shared milestone',true),($1,'Searchfix hidden milestone',false)",[p.id]);
 const search=async(actor,data={},project=null)=>(await pool.query('select project_search($1,\'list\',$2,$3) data',[actor,project,{q:'Searchfix',...data}])).rows[0].data;
 let data=await search(manager);assert.equal(data.results.length,25);assert.ok(data.nextCursor);
 const all=[];let cursor;
 do{data=await search(manager,cursor?{after:cursor}:{});all.push(...data.results);cursor=data.nextCursor;}while(cursor);
 assert.equal(all.length,58);assert.equal(new Set(all.map(x=>x.kind+':'+x.id)).size,58);
 assert.ok(all.every(x=>x.project_id===p.id));assert.ok(all.every(x=>Object.keys(x).sort().join(',')==='due_on,id,kind,project_id,project_key,project_name,status,title'));
 const page=await search(manager,{kind:'task',assigneeId:manager,status:'todo',from:'2026-11-15',to:'2026-11-15'});assert.equal(page.results.length,25);
 assert.equal((await search(manager,{from:'2026-11-16'})).results.length,0);
 assert.equal((await search(manager,{organizationId:other})).results.length,0);
 assert.equal((await search(manager,{},foreign.id)).results.length,0);
 assert.equal((await search(outsider)).results.length,0,'Tenant admin is not a project assignment');
 assert.equal((await search(manager,{q:'searchfixonly'})).results.length,0,'Descriptions are not searched');
 assert.equal((await search(manager,{q:'50%_'})).results.length,1,'Wildcards remain literal');
 assert.equal((await search(client,{kind:'milestone'})).results.length,1);
 const clientPage=await search(client,{kind:'task'});assert.equal(clientPage.results.length,25);assert.ok(clientPage.results.every(x=>Number(x.title.slice(-2))%2===0));
 await pool.query("update project_memberships set status='revoked' where project_id=$1 and user_id=$2",[p.id,manager]);
 assert.equal((await search(manager,{after:page.nextCursor})).results.length,0,'Old cursor confers no access after revocation');
 await pool.query("update project_memberships set status='active' where project_id=$1 and user_id=$2",[p.id,manager]);
 for(const sql of ["update organization_memberships set status='invited' where user_id=$1","update organization_memberships set status='suspended' where user_id=$1"]){await pool.query(sql,[client]);assert.equal((await search(client)).results.length,0);}
 await pool.query("update organization_memberships set status='active' where user_id=$1",[client]);
 await pool.query("update organizations set status='suspended' where id=$1",[org]);assert.equal((await search(client)).results.length,0);await pool.query("update organizations set status='active' where id=$1",[org]);
 await pool.query('update projects set client_visible=false where id=$1',[p.id]);assert.equal((await search(client)).results.length,0);
 await pool.query("update profiles set status='disabled' where id=$1",[manager]);await assert.rejects(search(manager),{code:'42501'});await pool.query("update profiles set status='active' where id=$1",[manager]);
 for(const bad of [{q:'x'},{q:'xx',unexpected:'x'},{q:'xx',kind:'comments'},{q:'xx',after:'0:not-a-cursor'},{q:'xx',kind:'project',assigneeId:manager},{q:[]},{q:'xx',from:'2026-02-30'}])await assert.rejects(search(manager,bad));
 for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('set role '+role);await assert.rejects(c.query('select project_search($1,\'list\',null,$2)',[manager,{q:'Searchfix'}]),{code:'42501'});}finally{await c.query('reset role');c.release();}}
 const {hashToken}=require('../../tokens'),raw='fixture-search-http';await pool.query("insert into portal_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[hashToken(raw),manager]);
 const server=require('./http-fixture')(pool).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port,headers={Cookie:'vsph.portal.sid='+raw};
 try{
  assert.equal((await fetch(base+'/api/search?q=Searchfix')).status,401);
  let r=await fetch(base+'/api/search?q=Searchfix',{headers});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).results.length,25);
  for(const suffix of ['q=x','q=xx&actor='+admin,'q=xx&q=yy','q=xx&from=2026-02-30','q=xx&after=bad'])assert.equal((await fetch(base+'/api/search?'+suffix,{headers})).status,400);
  await pool.query("update portal_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[hashToken(raw)]);assert.equal((await fetch(base+'/api/search?q=Searchfix',{headers})).status,401);
  await pool.query("update portal_sessions set expires_at=now()+interval '1 hour' where token_hash=$1",[hashToken(raw)]);
  await pool.query('delete from portal_sessions where token_hash=$1',[hashToken(raw)]);assert.equal((await fetch(base+'/api/search?q=Searchfix',{headers})).status,401);
 }finally{await new Promise(r=>server.close(r));}
};
