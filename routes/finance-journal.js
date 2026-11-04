const express=require('express'),{db,check}=require('../db'),{portalSession,requireAdmin}=require('../security'),{rpcRoute,uuid}=require('../services/rpc');
const router=express.Router();
router.use(portalSession,requireAdmin,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
function invalid(){const error=Error('Invalid journal filters or cursor. Refresh the first page.');error.validation=true;throw error;}
const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function validate(query){
 const allowed=['kind','organizationId','projectId','status','search','from','to','cursor'];
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(key=>!allowed.includes(key)||typeof query[key]!=='string'))invalid();
 const kind=query.kind||'invoices',data={};
 if(!['invoices','receipts'].includes(kind))invalid();
 for(const key of ['organizationId','projectId'])if(query[key]!==undefined){if(!uuid(query[key]))invalid();data[key]=query[key];}
 if(query.status!==undefined){if(!(kind==='invoices'?['all','issued','void']:['all','active','reversed']).includes(query.status))invalid();data.status=query.status;}
 if(query.search!==undefined){const term=query.search.trim();if(term.length>100||/[\u0000-\u001f\u007f]/.test(term)||/[\uD800-\uDFFF]/u.test(term))invalid();data.search=term;}
 for(const key of ['from','to'])if(query[key]!==undefined){if(!iso(query[key]))invalid();data[key]=query[key];}
 if(data.from&&data.to&&data.from>data.to)invalid();
 if(query.cursor!==undefined){
  if(query.cursor.length>500)invalid();let cursor;try{cursor=JSON.parse(query.cursor);}catch{invalid();}
  if(!cursor||typeof cursor!=='object'||Array.isArray(cursor)||Object.keys(cursor).length!==3||Object.keys(cursor).some(key=>!['at','id','scope'].includes(key))||!uuid(cursor.id)||typeof cursor.scope!=='string'||!/^[a-f0-9]{32}$/.test(cursor.scope)||typeof cursor.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(cursor.at)||!iso(cursor.at.slice(0,10))||!Number.isFinite(Date.parse(cursor.at)))invalid();
  // Preserve original microseconds: validation must never round the DB cursor.
  data.cursor=cursor;
 }
 return {kind,data};
}
router.get('/',rpcRoute(req=>{const {kind,data}=validate(req.query);return db().rpc('finance_journal',{p_actor:req.user.id,p_action:kind,p_id:null,p_data:data}).then(check);}));
module.exports={router,validate};
