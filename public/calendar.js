(() => {
 'use strict';
 const root=document.getElementById('employeeCalendar');
 if(!root)return;
 const $=id=>document.getElementById(id);
 const views=new Set(['month','week','day','list']);
 const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const state={date:new Date(),view:'month',events:[],canCompanySchedule:false,
  query:'',category:'',color:'',tag:'',loaded:false,editing:null,request:0};
 const safeEvent=e=>e&&typeof e.id==='string'&&typeof e.title==='string'&&
  Number.isFinite(Date.parse(e.startAt))&&Number.isFinite(Date.parse(e.endAt));
 const node=(tag,cls='',value)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(value!==undefined)el.textContent=String(value);
  return el;
 };
 const pad=n=>String(n).padStart(2,'0');
 const localKey=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
 const localTime=d=>pad(d.getHours())+':'+pad(d.getMinutes());
 const localInput=d=>localKey(d)+'T'+localTime(d);
 const atMidnight=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
 const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
 const startWeek=d=>addDays(atMidnight(d),-d.getDay());
 const eventDate=e=>new Date(e.startAt);
 const timeLabel=e=>localTime(eventDate(e))+'–'+localTime(new Date(e.endAt));
 const longDate=d=>d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 function range(){
  let a,b;
  if(state.view==='month'){
   a=startWeek(new Date(state.date.getFullYear(),state.date.getMonth(),1));
   b=addDays(a,42);
  }else if(state.view==='week'){a=startWeek(state.date);b=addDays(a,7);}
  else if(state.view==='day'){a=atMidnight(state.date);b=addDays(a,1);}
  else {a=new Date(state.date.getFullYear(),state.date.getMonth(),1);
   b=new Date(state.date.getFullYear(),state.date.getMonth()+1,1);}
  return {from:a.toISOString(),to:b.toISOString()};
 }
 async function request(url,options={}){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  if(r.status===401){window.location.assign('/login');throw Error('Session expired.');}
  if(!r.ok){
   const reason=await r.json().catch(()=>null);
   throw Error(reason?.message||'Unable to save calendar event.');
  }
  return r.json();
 }
 async function load(){
  const seq=++state.request,span=range();
  $('calendarStatus').textContent='Loading events…';
  try{
   const data=await request('/api/hrms/calendar?'+new URLSearchParams(span));
   if(seq!==state.request)return;
   if(!data||!Array.isArray(data.events))throw Error('Calendar response unavailable.');
   state.events=data.events.filter(safeEvent);
   state.canCompanySchedule=data.canCompanySchedule===true;
   state.loaded=true;
   $('calendarStatus').textContent='';
   updateTags();
   render();
  }catch(err){
   if(seq!==state.request)return;
   state.events=[];state.loaded=false;
   $('calendarGrid').replaceChildren();
   $('calendarStatus').textContent=err.message||'Calendar unavailable.';
  }
 }
 function filtered(){
  return state.events.filter(e=>{
   if(state.category&&e.category!==state.category)return false;
   if(state.color&&e.color!==state.color)return false;
   if(state.tag&&(!Array.isArray(e.tags)||!e.tags.includes(state.tag)))return false;
   if(state.query){
    const hay=[e.title,e.description,e.category,...(Array.isArray(e.tags)?e.tags:[])].join(' ').toLowerCase();
    if(!hay.includes(state.query))return false;
   }
   return true;
  }).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
 }
 function updateTags(){
  const tags=$('calendarFilterTag'),selected=state.tag;
  tags.replaceChildren(new Option('All tags',''));
  const available=new Set();
  for(const e of state.events)for(const tag of Array.isArray(e.tags)?e.tags:[])available.add(tag);
  for(const tag of [...available].sort())tags.append(new Option(tag,tag));
  if(available.has(selected))tags.value=selected;else{state.tag='';tags.value='';}
 }
 function title(){
  const d=state.date;
  let text;
  if(state.view==='month'||state.view==='list')text=d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  else if(state.view==='week')text='Week of '+startWeek(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  else text=longDate(d);
  $('calendarPeriod').textContent=text;
  for(const button of document.querySelectorAll('[data-calendar-view]'))
   button.setAttribute('aria-pressed',String(button.dataset.calendarView===state.view));
 }
 function badge(e,detail=false){
  const b=node('button','calendar-event',(detail?timeLabel(e)+' · ':'')+e.title);
  b.type='button';b.dataset.color=['blue','green','purple','orange','pink','red'].includes(e.color)?e.color:'blue';
  b.dataset.editable=String(e.canEdit===true);
  b.title=e.title+' · '+longDate(eventDate(e))+' · '+timeLabel(e);
  b.addEventListener('click',event=>{event.stopPropagation();openEvent(e);});
  if(e.canEdit===true){
   b.draggable=true;
   b.addEventListener('dragstart',event=>{
    event.dataTransfer.setData('text/plain',e.id);
    event.dataTransfer.effectAllowed='move';
   });
  }
  return b;
 }
 async function drop(e,date,hour){
  e.preventDefault();
  const id=e.dataTransfer.getData('text/plain');
  const current=state.events.find(x=>x.id===id&&x.canEdit===true);
  if(!current)return;
  const begin=eventDate(current),target=new Date(date);
  target.setHours(hour===undefined?begin.getHours():hour,hour===undefined?begin.getMinutes():0,0,0);
  const duration=Date.parse(current.endAt)-Date.parse(current.startAt);
  if(!Number.isFinite(duration)||duration<=0)return;
  try{
   await save({...current,startAt:target.toISOString(),endAt:new Date(target.getTime()+duration).toISOString()},current.id);
   await load();
  }catch(err){$('calendarStatus').textContent=err.message;}
 }
 function dropArea(el,date,hour){
  el.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/plain'))e.preventDefault();});
  el.addEventListener('drop',e=>{drop(e,date,hour);});
  el.addEventListener('dblclick',e=>{if(e.target.closest('.calendar-event'))return;openCreate(date,hour);});
 }
 function renderMonth(events){
  const grid=node('div','calendar-month');
  for(const day of names)grid.append(node('div','calendar-day-head',day));
  const first=startWeek(new Date(state.date.getFullYear(),state.date.getMonth(),1));
  for(let i=0;i<42;i++){
   const date=addDays(first,i),key=localKey(date);
   const cell=node('div','calendar-month-cell');
   cell.dataset.outside=String(date.getMonth()!==state.date.getMonth());
   const number=node('span','calendar-date-number',date.getDate());
   number.dataset.today=String(key===localKey(new Date()));
   cell.append(number);
   const dayEvents=events.filter(event=>localKey(eventDate(event))===key);
   const items=node('div','calendar-events');
   for(const ev of dayEvents.slice(0,3))items.append(badge(ev));
   if(dayEvents.length>3){
    const more=node('button','calendar-more','+'+(dayEvents.length-3)+' more');
    more.type='button';more.addEventListener('click',()=>{state.date=date;state.view='day';load();});
    items.append(more);
   }
   cell.append(items);dropArea(cell,date);
   grid.append(cell);
  }
  return grid;
 }
 function renderTimeline(events,week){
  const dates=week?Array.from({length:7},(_,i)=>addDays(startWeek(state.date),i)):[atMidnight(state.date)];
  const grid=node('div',week?'calendar-week-grid':'calendar-day-grid');
  grid.append(node('div','calendar-time-head','Time'));
  for(const day of dates)grid.append(node('div','calendar-time-head',
   day.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})));
  for(let hour=0;hour<24;hour++){
   grid.append(node('div','calendar-timeline-time',pad(hour)+':00'));
   for(const date of dates){
    const cell=node('div','calendar-timeline-cell');
    for(const event of events.filter(e=>{
     const start=eventDate(e);return localKey(start)===localKey(date)&&start.getHours()===hour;
    }))cell.append(badge(event,true));
    dropArea(cell,date,hour);
    grid.append(cell);
   }
  }
  return grid;
 }
 function renderList(events){
  const grid=node('div','calendar-list');
  const groups=new Map();
  for(const ev of events){
   const d=eventDate(ev),key=localKey(d);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(ev);
  }
  for(const [key,items] of groups){
   const group=node('section','calendar-list-group');
   group.append(node('h3','',longDate(new Date(key+'T12:00:00'))));
   for(const item of items)group.append(badge(item,true));
   grid.append(group);
  }
  if(!events.length)grid.append(node('p','calendar-empty','No events'));
  return grid;
 }
 function render(){
  title();
  const area=$('calendarGrid'),events=filtered();
  area.replaceChildren(state.view==='month'?renderMonth(events):
   state.view==='week'?renderTimeline(events,true):
   state.view==='day'?renderTimeline(events,false):renderList(events));
  if(!events.length&&state.view!=='list')$('calendarStatus').textContent='No events';
  else if(state.loaded)$('calendarStatus').textContent='';
 }
 function refresh(){if(state.loaded)render();}
 function changePeriod(delta){
  const d=state.date;
  if(state.view==='month'||state.view==='list')
   state.date=new Date(d.getFullYear(),d.getMonth()+delta,Math.min(d.getDate(),28));
  else if(state.view==='week')state.date=addDays(d,7*delta);
  else state.date=addDays(d,delta);
  load();
 }
 function toggleAttendees(){
  const form=$('calendarForm');
  const privateEvent=form.elements.scope.value==='personal';
  $('calendarAttendeesField').hidden=privateEvent;
  if(privateEvent)form.elements.attendees.value='';
 }
 function resetDialog(){
  const form=$('calendarForm');form.reset();
  $('calendarFormError').hidden=true;$('calendarDelete').hidden=true;
  $('calendarJoin').hidden=true;
  form.elements.title.disabled=false;
  for(const name of ['title','description','startAt','endAt','category','color','scope','attendees','tags','meetUrl'])
   form.elements[name].disabled=false;
  $('calendarSave').hidden=false;
  const scope=form.elements.scope;
  scope.replaceChildren(new Option('Personal','personal'),new Option('Team meeting','team'));
  if(state.canCompanySchedule)scope.append(new Option('Company meeting','company'));
  form.elements.color.value='blue';
  form.elements.category.value='meeting';
  toggleAttendees();
 }
 function openCreate(date=new Date(),hour){
  state.editing=null;resetDialog();
  $('calendarDialogTitle').textContent='New event';
  const form=$('calendarForm');
  const begin=new Date(date);
  if(hour!==undefined)begin.setHours(hour,0,0,0);
  else if(begin.getHours()===0&&begin.getMinutes()===0)begin.setHours(9,0,0,0);
  else{begin.setMinutes(0,0,0);begin.setHours(begin.getHours()+1);}
  form.elements.startAt.value=localInput(begin);
  form.elements.endAt.value=localInput(new Date(begin.getTime()+60*60000));
  $('calendarDialog').showModal();
  form.elements.title.focus();
 }
 function openEvent(ev){
  state.editing=ev;resetDialog();
  const form=$('calendarForm');
  $('calendarDialogTitle').textContent=ev.canEdit?'Edit event':'Event details';
  for(const key of ['title','description','category','color','scope','meetUrl'])
   if(key in ev){
    if(key==='scope'&&![...form.elements.scope.options].some(x=>x.value===ev.scope))
     form.elements.scope.append(new Option('Company meeting','company'));
    form.elements[key].value=ev[key];
   }
  form.elements.startAt.value=localInput(new Date(ev.startAt));
  form.elements.endAt.value=localInput(new Date(ev.endAt));
  form.elements.attendees.value=Array.isArray(ev.attendees)?ev.attendees.join(', '):'';
  form.elements.tags.value=Array.isArray(ev.tags)?ev.tags.join(', '):'';
  toggleAttendees();
  if(ev.meetUrl&&/^https:\/\/meet\.google\.com\/[a-z0-9/_-]+$/i.test(ev.meetUrl)){
   $('calendarJoin').href=ev.meetUrl;$('calendarJoin').hidden=false;
  }
  if(ev.canEdit){
   $('calendarDelete').hidden=false;
  }else{
   for(const name of ['title','description','startAt','endAt','category','color','scope','attendees','tags','meetUrl'])
    form.elements[name].disabled=true;
   $('calendarSave').hidden=true;
  }
  $('calendarDialog').showModal();
 }
 function formPayload(){
  const form=$('calendarForm');
  const start=new Date(form.elements.startAt.value),end=new Date(form.elements.endAt.value);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw Error('Choose a valid start and end time.');
  const scope=form.elements.scope.value;
  const attendees=scope==='personal'?[]:form.elements.attendees.value.split(',').map(s=>s.trim()).filter(Boolean);
  return {title:form.elements.title.value.trim(),description:form.elements.description.value,
   startAt:start.toISOString(),endAt:end.toISOString(),category:form.elements.category.value,
   color:form.elements.color.value,scope,
   tags:form.elements.tags.value.split(',').map(s=>s.trim()).filter(Boolean),
   attendees,meetUrl:form.elements.meetUrl.value.trim()};
 }
 async function save(payload,id){
  const editing=!!id;
  const body=editing?{...payload,version:payload.version}:
   {...payload,id:crypto.randomUUID()};
  return request(editing?'/api/hrms/calendar/'+encodeURIComponent(id):'/api/hrms/calendar',{
   method:editing?'PATCH':'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body)
  });
 }
 async function submit(e){
  e.preventDefault();
  const btn=$('calendarSave');btn.disabled=true;
  try{
   const payload=formPayload();
   if(state.editing)payload.version=state.editing.version;
   await save(payload,state.editing?.id);
   $('calendarDialog').close();await load();
  }catch(err){
   const error=$('calendarFormError');error.hidden=false;error.textContent=err.message;
  }finally{btn.disabled=false;}
 }
 async function remove(){
  if(!state.editing||!state.editing.canEdit)return;
  if(!window.confirm('Delete this event?'))return;
  const btn=$('calendarDelete');btn.disabled=true;
  try{
   await request('/api/hrms/calendar/'+encodeURIComponent(state.editing.id),{
    method:'DELETE',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({version:state.editing.version})
   });
   $('calendarDialog').close();await load();
  }catch(err){
   const el=$('calendarFormError');el.hidden=false;el.textContent=err.message;
  }finally{btn.disabled=false;}
 }
 let mounted=false;
 function mount(){
  if(mounted)return;mounted=true;
  $('calendarPrevious').addEventListener('click',()=>changePeriod(-1));
  $('calendarNext').addEventListener('click',()=>changePeriod(1));
  $('calendarToday').addEventListener('click',()=>{state.date=new Date();load();});
  $('calendarNew').addEventListener('click',()=>openCreate());
  for(const button of document.querySelectorAll('[data-calendar-view]'))
   button.addEventListener('click',()=>{if(!views.has(button.dataset.calendarView))return;
    state.view=button.dataset.calendarView;load();});
  $('calendarSearch').addEventListener('input',e=>{state.query=e.target.value.toLowerCase().trim();refresh();});
  for(const [id,key] of [['calendarFilterCategory','category'],['calendarFilterColor','color'],['calendarFilterTag','tag']])
   $(id).addEventListener('change',e=>{state[key]=e.target.value;refresh();});
  $('calendarScope').addEventListener('change',toggleAttendees);
  $('calendarForm').addEventListener('submit',submit);
  $('calendarClose').addEventListener('click',()=>$('calendarDialog').close());
  $('calendarCancel').addEventListener('click',()=>$('calendarDialog').close());
  $('calendarDelete').addEventListener('click',remove);
  load();
 }
 window.VSPHCalendar={mount};
})();
