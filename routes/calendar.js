'use strict';
const express=require('express');
const {portalSession}=require('../security');
const {db,check}=require('../db');
const {uuid,rpcRoute}=require('../services/rpc');
const router=express.Router();
router.use(portalSession,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
const CATEGORIES=new Set(['meeting','task','reminder','personal']);
const COLORS=new Set(['blue','green','purple','orange','pink','red']);
const SCOPES=new Set(['personal','team','company']);
const error=message=>{const e=Error(message);e.validation=true;throw e;};
function keys(value,expected){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==expected.length||
    expected.some(key=>!Object.hasOwn(value,key)))error('Review the event fields.');
}
function date(value){
 if(typeof value!=='string'||value.length>35||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)||
  !Number.isFinite(Date.parse(value)))error('Choose a valid date and time.');
 return new Date(value).toISOString();
}
function meetingLink(value){
 if(typeof value!=='string'||value.length>300)error('Use a valid Google Meet link.');
 if(!value)return '';
 let link;
 try{link=new URL(value);}catch{error('Use a valid Google Meet link.');}
 if(link.protocol!=='https:'||link.hostname!=='meet.google.com'||link.port||
   link.username||link.password||link.search||link.hash||
   !/^\/[a-z0-9/_-]+$/i.test(link.pathname))error('Use a valid Google Meet link.');
 return link.toString();
}
function payload(body,updating=false){
 const fields=['title','description','startAt','endAt','category','color','scope','tags','attendees','meetUrl'];
 if(updating)fields.push('version');
 keys(body,fields);
 if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>120||
  typeof body.description!=='string'||body.description.length>1000||
  !CATEGORIES.has(body.category)||!COLORS.has(body.color)||!SCOPES.has(body.scope))error('Review the event details.');
 const startAt=date(body.startAt),endAt=date(body.endAt);
 if(Date.parse(endAt)<=Date.parse(startAt)||Date.parse(endAt)-Date.parse(startAt)>14*86400000)error('Event end must follow its start within 14 days.');
 if(!Array.isArray(body.tags)||body.tags.length>8||
  body.tags.some(x=>typeof x!=='string'||!x.trim()||x.length>32))error('Use up to eight short tags.');
 const tags=[...new Set(body.tags.map(x=>x.trim()))];
 if(!Array.isArray(body.attendees)||body.attendees.length>20||
  body.attendees.some(x=>typeof x!=='string'||x.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim())))error('Enter valid employee email addresses.');
 const attendees=[...new Set(body.attendees.map(x=>x.trim().toLowerCase()))];
 if(body.scope==='personal'&&attendees.length)error('Personal events cannot invite attendees.');
 if(updating&&(!Number.isInteger(body.version)||body.version<1||body.version>2147483646))error('Reload the event before editing.');
 return {title:body.title.trim(),description:body.description,startAt,endAt,
  category:body.category,color:body.color,scope:body.scope,tags,attendees,
  meetUrl:meetingLink(body.meetUrl),...(updating?{version:body.version}:{})};
}
function calendar(req,action,id,data){
 return db().rpc('internal_calendar',{
  p_actor:req.user.id,p_action:action,p_id:id,
  p_data:{...data,currentHash:req.portalSession.token_hash}
 }).then(check);
}
router.get('/',rpcRoute(req=>{
 if(Object.keys(req.query).length!==2||typeof req.query.from!=='string'||
  typeof req.query.to!=='string')error('Choose a calendar date range.');
 const from=date(req.query.from),to=date(req.query.to);
 if(Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>370*86400000)error('Calendar range too large.');
 return calendar(req,'list',null,{from,to});
}));
router.post('/',rpcRoute(req=>{
 if(Object.keys(req.query).length||!uuid(req.body?.id))error('Create a valid event.');
 const data=payload((({id,...rest})=>rest)(req.body));
 return calendar(req,'create',req.body.id,data);
}));
router.patch('/:id',rpcRoute(req=>{
 if(Object.keys(req.query).length||!uuid(req.params.id))error('Choose a valid event.');
 return calendar(req,'save',req.params.id,payload(req.body,true));
}));
router.delete('/:id',rpcRoute(req=>{
 if(Object.keys(req.query).length||!uuid(req.params.id))error('Choose a valid event.');
 keys(req.body,['version']);
 if(!Number.isInteger(req.body.version)||req.body.version<1||req.body.version>2147483646)error('Reload the event before deleting.');
 return calendar(req,'delete',req.params.id,{version:req.body.version});
}));
module.exports={router,payload,date,meetingLink};
