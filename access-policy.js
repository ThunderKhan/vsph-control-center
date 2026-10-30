function validSubscription(s,nowMs=Date.now()){
 return ['active','trial'].includes(s.status)&&(!s.ends_at||new Date(s.ends_at).getTime()>nowMs);
}
function permittedContexts({user,app,organizations,subscriptions,grants,memberships=[],roles=[],nowMs=Date.now()}){
 if(!user||!app||app.status!=='active')return [];
 const subscribed=new Set(subscriptions.filter(s=>s.application_id===app.id&&validSubscription(s,nowMs)).map(s=>s.organization_id));
 const enabled=new Set(grants.filter(g=>g.application_id===app.id&&g.status==='enabled').map(g=>g.organization_id));
 const isPlatformAdmin=user.platform_role==='super_admin';
 const memberOrgs=new Set(memberships.filter(m=>m.user_id===user.id&&m.status==='active').map(m=>m.organization_id));
 const userRoles=roles.filter(r=>r.user_id===user.id&&r.application_id===app.id);
 return organizations.filter(o=>o.status==='active'&&subscribed.has(o.id)&&enabled.has(o.id))
 .filter(o=>isPlatformAdmin||(memberOrgs.has(o.id)&&userRoles.some(r=>r.organization_id===o.id)))
 .map(o=>({...o,role:isPlatformAdmin?'platform_super_admin':userRoles.find(r=>r.organization_id===o.id).role_code}));
}
module.exports={validSubscription,permittedContexts};
