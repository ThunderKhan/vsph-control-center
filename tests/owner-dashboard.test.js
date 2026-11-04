const test=require('node:test'),assert=require('node:assert/strict');
const {ownerDashboard}=require('../services/owner-dashboard');
function client(failed){
 const reads=[];
 return {reads,from(table){
  const entry={table};reads.push(entry);
  const q={select(fields,options){entry.fields=fields;entry.options=options;return q;},eq(key,value){entry.filter=[key,value];return q;},in(key,value){entry.in=[key,value];return q;},lt(key,value){entry.before=[key,value];return q;},gte(key,value){entry.after=[key,value];return q;},order(){return q;},limit(n){entry.limit=n;return q;},then(resolve,reject){
   const id='11111111-1111-4111-8111-111111111111';
   const counts={organizations:{total:3,active:2,suspended:1},internal_employees:{total:3,active:2,onboarding:1},projects:{active:2,completed:1},project_tasks:{total:6,done:2,cancelled:1,blocked:1},applications:{total:2,active:2},project_milestones:{total:1}};
   const rows=table==='applications'?[{id,name:'Real product',code:'CRM',status:'active',private:'secret'}]:table==='project_milestones'?[{id,project_id:id,title:'Real milestone',due_on:'2030-01-01',status:'planned',private:'secret'}]:table==='project_activity'?[{project_id:id,action:'task.create',created_at:'2026-11-01T00:00:00Z',private:'secret'}]:[{id,name:'Real project',status:'active',kind:'internal',created_at:'x',private:'secret'}];
   return Promise.resolve(table===failed?{error:{message:'private provider details'}}:entry.options?.head?{count:entry.before?1:counts[table]?.[entry.filter?.[1]||'total']??0}:{data:rows}).then(resolve,reject);
  }};return q;
 }};
}
test('owner dashboard uses exact aggregate counts and bounded project allowlists',async()=>{
 const db=client(),result=await ownerDashboard(db);
 assert.equal(result.customers.active,2);assert.equal(result.workforce.total,3);
 assert.deepEqual(Object.keys(result.delivery.recent[0]).sort(),['id','kind','name','status']);
 assert.equal(db.reads.find(r=>r.limit).limit,6);
 assert.ok(db.reads.filter(r=>!r.limit).every(r=>r.options.count==='exact'&&r.options.head));
});
test('conflicting task observations clear only delivery, preserving other module counts',async()=>{
 const db=client(),original=db.from;db.from=table=>{
  if(table!=='project_tasks')return original(table);
  const q={select(){return q;},eq(){return q;},then(resolve,reject){return Promise.resolve({count:3}).then(resolve,reject);}};return q;
 };
 const report=await ownerDashboard(db);
 assert.deepEqual(report.delivery,{status:'unavailable'});assert.equal(report.customers.active,2);assert.equal(report.workforce.total,3);
});
test('a missing module never invents zero counts or hides other operating sections',async()=>{
 const result=await ownerDashboard(client('project_tasks'));
 assert.deepEqual(result.delivery,{status:'unavailable'});
 assert.equal(result.customers.status,'ready');assert.equal(result.workforce.status,'ready');
 assert.doesNotMatch(JSON.stringify(result),/private provider details|secret/);
});
test('attention, catalog and activity are bounded, allowlisted and owned by database observations',async()=>{
 const db=client(),report=await ownerDashboard(db);
 assert.equal(report.attention.overdueTasks,1);assert.equal(report.attention.overdueMilestones,1);
 assert.deepEqual(Object.keys(report.attention.upcoming[0]).sort(),['dueOn','id','projectId','status','title']);
 assert.deepEqual(Object.keys(report.products.catalog[0]).sort(),['code','id','name','status']);
 assert.deepEqual(Object.keys(report.activity.items[0]).sort(),['action','createdAt','projectId']);
 assert.equal(db.reads.find(r=>r.table==='applications'&&r.limit).limit,3);
 assert.equal(db.reads.find(r=>r.table==='project_milestones'&&r.limit).limit,5);
 assert.equal(db.reads.find(r=>r.table==='project_activity').limit,6);
 const overdue=db.reads.find(r=>r.table==='project_tasks'&&r.before);
 assert.deepEqual(overdue.in,['status',['todo','in_progress','blocked','in_review']]);
 assert.equal(overdue.before[1],report.attention.asOf);
 assert.doesNotMatch(JSON.stringify(report),/private|secret/);
});
test('unavailable milestone or activity data never clears authorized company metrics',async()=>{
 for(const table of ['project_milestones','project_activity']){
  const report=await ownerDashboard(client(table));
  assert.equal(report[table==='project_milestones'?'attention':'activity'].status,'unavailable');
  assert.equal(report.customers.status,'ready');assert.equal(report.products.status,'ready');
 }
});
