// Owner-only aggregate read model. No customer/product roles are inferred.
async function ownerDashboard(client) {
 const count=async(table,status,filter=q=>q)=>{
  let q=client.from(table).select('id',{count:'exact',head:true});
  if(status)q=q.eq('status',status);
  const result=await filter(q);
  if(result.error)throw result.error;
  if(!Number.isSafeInteger(result.count)||result.count<0)throw Error('Invalid count');
  return result.count;
 };
 const section=async(fn)=>{try{return {status:'ready',...await fn()};}catch{return {status:'unavailable'};}};
 const today=new Date().toISOString().slice(0,10);
 const [customers,delivery,workforce,products,attention,activity]=await Promise.all([
  section(async()=>{const [total,active,suspended]=await Promise.all([count('organizations'),count('organizations','active'),count('organizations','suspended')]);if(active+suspended>total)throw Error('Customer observation changed');return {total,active,suspended};}),
  section(async()=>{
   const [active,completed,tasks,done,cancelled,blocked,recent]=await Promise.all([
    count('projects','active'),count('projects','completed'),count('project_tasks'),count('project_tasks','done'),count('project_tasks','cancelled'),count('project_tasks','blocked'),
    client.from('projects').select('id,name,status,kind,created_at').eq('status','active').order('created_at',{ascending:false}).limit(6)
   ]);
   if(recent.error)throw recent.error;
   // These counts are independent observations. A concurrent status transition
   // can make them inconsistent; fail this section only, never other modules.
   if(done+cancelled+blocked>tasks)throw Error('Delivery observation changed');
   return {active,completed,tasks,done,cancelled,blocked,recent:recent.data.map(p=>({id:p.id,name:p.name,status:p.status,kind:p.kind}))};
  }),
  section(async()=>{const [total,active,onboarding]=await Promise.all([count('internal_employees'),count('internal_employees','active'),count('internal_employees','onboarding')]);if(active+onboarding>total)throw Error('Workforce observation changed');return {total,active,onboarding};}),
  section(async()=>{const [total,active,catalog]=await Promise.all([count('applications'),count('applications','active'),client.from('applications').select('id,name,code,status').order('created_at',{ascending:false}).limit(3)]);if(catalog.error)throw catalog.error;return {total,active,catalog:catalog.data.map(p=>({id:p.id,name:p.name,code:p.code,status:p.status}))};}),
  section(async()=>{
   const [overdueTasks,overdueMilestones,upcoming]=await Promise.all([
    count('project_tasks',null,q=>q.in('status',['todo','in_progress','blocked','in_review']).lt('due_on',today)),
    count('project_milestones',null,q=>q.in('status',['planned','active']).lt('due_on',today)),
    client.from('project_milestones').select('id,project_id,title,due_on,status').in('status',['planned','active']).gte('due_on',today).order('due_on').limit(5)
   ]);
   if(upcoming.error)throw upcoming.error;
   return {overdueTasks,overdueMilestones,asOf:today,upcoming:upcoming.data.map(m=>({id:m.id,projectId:m.project_id,title:m.title,dueOn:m.due_on,status:m.status}))};
  }),
  section(async()=>{const result=await client.from('project_activity').select('project_id,action,created_at').order('id',{ascending:false}).limit(6);if(result.error)throw result.error;return {items:result.data.map(a=>({projectId:a.project_id,action:a.action,createdAt:a.created_at}))};})
 ]);
 return {observedAt:new Date().toISOString(),customers,delivery,workforce,products,attention,activity};
}
module.exports={ownerDashboard};
