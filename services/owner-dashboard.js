// Owner-only aggregate read model. No customer/product roles are inferred.
async function ownerDashboard(client) {
 const count=async(table,status)=>{
  let q=client.from(table).select('id',{count:'exact',head:true});
  if(status)q=q.eq('status',status);
  const result=await q;
  if(result.error)throw result.error;
  if(!Number.isSafeInteger(result.count)||result.count<0)throw Error('Invalid count');
  return result.count;
 };
 const section=async(fn)=>{try{return {status:'ready',...await fn()};}catch{return {status:'unavailable'};}};
 const [customers,delivery,workforce,products]=await Promise.all([
  section(async()=>{const [total,active,suspended]=await Promise.all([count('organizations'),count('organizations','active'),count('organizations','suspended')]);return {total,active,suspended};}),
  section(async()=>{
   const [active,completed,tasks,done,cancelled,blocked,recent]=await Promise.all([
    count('projects','active'),count('projects','completed'),count('project_tasks'),count('project_tasks','done'),count('project_tasks','cancelled'),count('project_tasks','blocked'),
    client.from('projects').select('id,name,status,kind,created_at').eq('status','active').order('created_at',{ascending:false}).limit(6)
   ]);
   if(recent.error)throw recent.error;
   return {active,completed,tasks,done,cancelled,blocked,recent:recent.data.map(p=>({id:p.id,name:p.name,status:p.status,kind:p.kind}))};
  }),
  section(async()=>{const [total,active,onboarding]=await Promise.all([count('internal_employees'),count('internal_employees','active'),count('internal_employees','onboarding')]);return {total,active,onboarding};}),
  section(async()=>{const [total,active]=await Promise.all([count('applications'),count('applications','active')]);return {total,active};})
 ]);
 return {observedAt:new Date().toISOString(),customers,delivery,workforce,products};
}
module.exports={ownerDashboard};
