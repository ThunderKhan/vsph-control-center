const express = require('express');
const {db,check} = require('../db');
const {portalSession} = require('../security');
const {rateLimit} = require('../http-security');
const {uuid,rpcRoute} = require('../services/rpc');
function searchQuery(query) {
 const invalid=()=>{const e=Error('Use 2–100 characters and valid search filters.');e.validation=true;throw e;};
 const allowed=['q','kind','projectId','organizationId','assigneeId','status','from','to','after'];
 if(!query||Object.keys(query).some(k=>!allowed.includes(k))||Object.values(query).some(v=>typeof v!=='string'))invalid();
 const q=String(query.q||'').trim(),kind=query.kind||'all';
 if(q.length<2||q.length>100||/[\u0000-\u001f\u007f]/.test(q)||!['all','project','task','milestone'].includes(kind))invalid();
 for(const k of ['projectId','organizationId','assigneeId'])if(query[k]&&!uuid(query[k]))invalid();
 if(query.assigneeId&&kind!=='task')invalid();
 if(query.status&&!['planned','active','paused','completed','archived','todo','in_progress','blocked','in_review','done','cancelled'].includes(query.status))invalid();
 for(const k of ['from','to'])if(query[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(query[k])||Number.isNaN(Date.parse(query[k]))||new Date(query[k]).toISOString().slice(0,10)!==query[k]))invalid();
 if(query.from&&query.to&&query.from>query.to)invalid();
 if(query.after&&!/^[123]:[0-9a-f-]{36}$/i.test(query.after))invalid();
 if(query.after&&!uuid(query.after.slice(2)))invalid();
 const data={q,kind};for(const k of allowed.filter(k=>!['q','kind','projectId'].includes(k)))if(query[k])data[k]=query[k];
 return {projectId:query.projectId||null,data};
}
const router=express.Router();
router.use(portalSession,(req,res,next)=>{res.set('Cache-Control','no-store');next();},rateLimit({limit:60,windowMs:60000}));
router.get('/',rpcRoute(req=>{
 const {projectId,data}=searchQuery(req.query);
 return db().rpc('project_search',{p_actor:req.user.id,p_action:'list',p_id:projectId,p_data:data}).then(check);
}));
module.exports={router,searchQuery};
