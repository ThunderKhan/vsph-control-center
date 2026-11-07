// Test-only Supabase query transport adapter. Queries execute against native PostgreSQL.
// This verifies Express/middleware with durable rows, NOT the PostgREST or Auth service.
const {createRequire}=require('node:module');
module.exports=function databaseBackedServer(pool,auth,credentialFactory){
 const allowedTables=new Set(['portal_sessions','app_sessions','profiles','applications','organizations',
  'subscriptions','organization_app_access','organization_memberships','user_app_roles','music_requests','crm_contacts','projects','project_tasks','project_milestones','project_activity','internal_employees','internal_hr_managers','audit_logs','internal_employee_link_requests']);
 const identifier=value=>{if(!/^[a-z_]+$/.test(value))throw Error('Invalid test identifier');return '"'+value+'"'};
 function from(table){
  if(!allowedTables.has(table))throw Error('Unexpected fixture table');
  let fields='*',limit=1000,mode='select',payload;
  const predicates=[],values=[];
  const q={
   select(value,options={}){fields=value;q.countOnly=options.head===true&&options.count==='exact';return q},eq(key,value){values.push(value);predicates.push(identifier(key)+'=$'+values.length);return q},
   in(key,value){values.push(value);predicates.push(identifier(key)+'=any($'+values.length+(key.endsWith('id')?'::uuid[])':'::text[])'));return q},
   lt(key,value){values.push(value);predicates.push(identifier(key)+'<$'+values.length);return q},
   gte(key,value){values.push(value);predicates.push(identifier(key)+'>=$'+values.length);return q},
   limit(value){limit=value;return q},order(key,{ascending=true}={}){q.sort=identifier(key)+(ascending?' asc':' desc');return q},
   insert(value){mode='insert';payload=value;return q},
   delete(){if(!['portal_sessions','app_sessions'].includes(table))throw Error('Unexpected fixture delete');mode='delete';return q},
   async execute(single=false){try{
    const joined=table==='portal_sessions'&&fields===require('../../services/portal-session-fields').PORTAL_SESSION_FIELDS;
    const columns=joined?'token_hash,user_id,expires_at,profile':fields==='*'?'*':fields.split(',').map(identifier).join(',');
    const source=joined?"(select s.token_hash,s.user_id,s.expires_at,jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'status',p.status,'platform_role',p.platform_role) profile from portal_sessions s join profiles p on p.id=s.user_id) session_data":identifier(table);
    if(q.countOnly){const r=await pool.query('select count(*)::integer count from '+identifier(table)+(predicates.length?' where '+predicates.join(' and '):''),values);return {data:null,count:r.rows[0].count,error:null};}
    let sql;
    if(mode==='insert'){
     const keys=Object.keys(payload);sql='insert into '+identifier(table)+' ('+keys.map(identifier).join(',')+') values ('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning '+columns;
     const r=await pool.query(sql,keys.map(key=>payload[key]));const rows=JSON.parse(JSON.stringify(r.rows));return {data:single?rows[0]||null:rows,error:null};
    }
    if(mode==='delete'){const r=await pool.query('delete from '+identifier(table)+(predicates.length?' where '+predicates.join(' and '):'')+' returning '+columns,values);return {data:r.rows,error:null};}
    sql='select '+columns+' from '+source+(predicates.length?' where '+predicates.join(' and '):'')+(q.sort?' order by '+q.sort:'')+' limit '+Number(limit);
    const r=await pool.query(sql,values);
    // PostgREST returns DATE as calendar text. Do not timezone-shift it through
    // a native pg Date on Windows/IST while emulating the query transport.
    const dates=r.fields.filter(f=>f.dataTypeID===1082).map(f=>f.name);
    const rows=JSON.parse(JSON.stringify(r.rows.map(row=>{const result={...row};for(const key of dates){const d=result[key];if(d instanceof Date)result[key]=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}return result;})));
    return {data:single?rows[0]||null:rows,error:null};
   }catch(error){return {data:null,error}}},
   maybeSingle(){return q.execute(true)},single(){return q.execute(true)},then(resolve,reject){return q.execute().then(resolve,reject)}
  };return q;
 }
 const dbPath=require.resolve('../../db');
 require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{db:()=>({from,auth,rpc:async(name,args)=>{
 if(!['provisioning_command','project_command','project_search','delivery_command','notification_command','project_report','session_command','customer_command','product_command','customer_lifecycle','organization_command','organization_invitation','organization_ownership','internal_employee_command','internal_employee_removal','internal_employee_identity','internal_employee_enrollment','internal_employee_credentials','finance_command','finance_report','finance_journal','account_profile','owner_dashboard_snapshot','hrms_access','internal_self_service','internal_hrms','internal_work_activity'].includes(name))throw Error('Unexpected fixture RPC');
 try{const r=await (name==='internal_work_activity'?pool.query('select public.internal_work_activity($1::uuid,$2::text) data',[args.p_actor,args.p_session_hash]):pool.query('select public.'+name+'($1::uuid,$2::text,$3::uuid,$4::jsonb) data',[args.p_actor,args.p_action,args.p_id||null,args.p_data||{}]));return {data:r.rows[0].data,error:null}}catch(error){return {data:null,error}}
 }}),configured:()=>true,
  check:({data,error})=>{if(error)throw error;return data},publicAuth:credentialFactory||(()=>{throw Error('Real Supabase Auth not available in fixture')})}};
 for(const file of ['../../security','../../routes/admin-management','../../routes/profile','../../routes/hrms','../../routes/employee-identity','../../routes/employee-enrollment','../../services/employee-enrollment','../../routes/employee-credentials','../../services/employee-credentials','../../routes/search','../../routes/apps','../../routes/auth','../../routes/organizations','../../routes/ownership','../../services/verify-identity','../../server'])delete require.cache[require.resolve(file)];
 return require('../../server');
};
