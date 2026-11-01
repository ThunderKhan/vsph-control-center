// Test-only Supabase query transport adapter. Queries execute against native PostgreSQL.
// This verifies Express/middleware with durable rows, NOT the PostgREST or Auth service.
const {createRequire}=require('node:module');
module.exports=function databaseBackedServer(pool,auth){
 const allowedTables=new Set(['portal_sessions','app_sessions','profiles','applications','organizations',
  'subscriptions','organization_app_access','organization_memberships','user_app_roles','music_requests','crm_contacts']);
 const identifier=value=>{if(!/^[a-z_]+$/.test(value))throw Error('Invalid test identifier');return '"'+value+'"'};
 function from(table){
  if(!allowedTables.has(table))throw Error('Unexpected fixture table');
  let fields='*',limit=1000,mode='select',payload;
  const predicates=[],values=[];
  const q={
   select(value){fields=value;return q},eq(key,value){values.push(value);predicates.push(identifier(key)+'=$'+values.length);return q},
   in(key,value){values.push(value);predicates.push(identifier(key)+'=any($'+values.length+'::uuid[])');return q},
   limit(value){limit=value;return q},order(key,{ascending=true}={}){q.sort=identifier(key)+(ascending?' asc':' desc');return q},
   insert(value){mode='insert';payload=value;return q},
   delete(){if(!['portal_sessions','app_sessions'].includes(table))throw Error('Unexpected fixture delete');mode='delete';return q},
   async execute(single=false){try{
    const columns=fields==='*'?'*':fields.split(',').map(identifier).join(',');
    let sql;
    if(mode==='insert'){
     const keys=Object.keys(payload);sql='insert into '+identifier(table)+' ('+keys.map(identifier).join(',')+') values ('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning '+columns;
     const r=await pool.query(sql,keys.map(key=>payload[key]));return {data:single?r.rows[0]||null:r.rows,error:null};
    }
    if(mode==='delete'){const r=await pool.query('delete from '+identifier(table)+(predicates.length?' where '+predicates.join(' and '):'')+' returning '+columns,values);return {data:r.rows,error:null};}
    sql='select '+columns+' from '+identifier(table)+(predicates.length?' where '+predicates.join(' and '):'')+(q.sort?' order by '+q.sort:'')+' limit '+Number(limit);
    const r=await pool.query(sql,values);return {data:single?r.rows[0]||null:r.rows,error:null};
   }catch(error){return {data:null,error}}},
   maybeSingle(){return q.execute(true)},single(){return q.execute(true)},then(resolve,reject){return q.execute().then(resolve,reject)}
  };return q;
 }
 const dbPath=require.resolve('../../db');
 require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{db:()=>({from,auth,rpc:async(name,args)=>{
 if(!['provisioning_command','project_command','delivery_command','notification_command','project_report','session_command','customer_command','product_command'].includes(name))throw Error('Unexpected fixture RPC');
 try{const r=await pool.query('select public.'+name+'($1::uuid,$2::text,$3::uuid,$4::jsonb) data',[args.p_actor,args.p_action,args.p_id||null,args.p_data||{}]);return {data:r.rows[0].data,error:null}}catch(error){return {data:null,error}}
 }}),configured:()=>true,
  check:({data,error})=>{if(error)throw error;return data},publicAuth:()=>{throw Error('Real Supabase Auth not available in fixture')}}};
 for(const file of ['../../security','../../routes/apps','../../server'])delete require.cache[require.resolve(file)];
 return require('../../server');
};
