(() => {
 'use strict';
 // Faithful DOM adaptation of the supplied GitHubActivity component. The
 // application is HTML/CSS/JS, so React/Motion are intentionally not bundled.
 const root=document.getElementById('workActivity');
 if(!root)return;
 const CELL_SIZE=11,MONTHS=12,STACK_LIMIT=3,MIN_CARD_WIDTH=320;
 const GAP=Math.max(2,Math.round(CELL_SIZE/4));
 const WEEKS_PER_MONTH=365.25/12/7,COLUMN_STAGGER=12;
 const TOOLTIP_EDGE=8,DAY=86400000;
 const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const levels=['#ffffff22','#B9DEFC','#83C5F5','#4AA5E8','#1475BD'];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const node=(tag,className='',content)=>{
  const el=document.createElement(tag);if(className)el.className=className;
  if(content!==undefined)el.textContent=String(content);return el;
 };
 const card=node('div','work-activity-card');
 const header=node('p','work-activity-heading','Recorded task completions · Last 12 months');
 const gridWidth=node('div','work-activity-grid-width');
 const monthRow=node('div','work-activity-months');
 const weekRow=node('div','work-activity-weeks');
 const drawer=node('section','work-activity-drawer');
 const drawerHeader=node('div','work-activity-drawer-heading');
 const drawerLabel=node('span','work-activity-drawer-label','Top projects');
 const avatars=node('div','work-activity-avatars');
 const toggle=node('button','work-activity-toggle');
 const chevron=node('span','work-activity-chevron','⌄');
 const projectsList=node('ul','work-activity-project-list');
 toggle.type='button';toggle.setAttribute('aria-label','Show top projects');
 toggle.setAttribute('aria-controls','workActivityProjects');toggle.setAttribute('aria-expanded','false');
 projectsList.id='workActivityProjects';projectsList.setAttribute('aria-hidden','true');
 toggle.append(chevron);drawerHeader.append(drawerLabel,avatars,toggle);
 drawer.append(drawerHeader,projectsList);
 gridWidth.append(monthRow,weekRow);
 card.append(header,gridWidth,drawer);
 root.append(card);
 let weeks=[],projects=[],rendered=false,open=false,request=0,tooltip=null,widthLast=-1;
 function escapeDateKey(ms){return new Date(ms).toISOString().slice(0,10);}
 function parseDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d.getTime():NaN;
 }
 function dayDescription(day){
  const formatted=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})
   .format(new Date(day.date+'T00:00:00Z'));
  return day.count+' '+(day.count===1?'task completion':'task completions')+' on '+formatted;
 }
 function hideTooltip(){if(tooltip){tooltip.remove();tooltip=null;}}
 function showTooltip(day,cell){
  hideTooltip();
  const tip=node('div','work-activity-tooltip',dayDescription(day));
  tip.setAttribute('role','tooltip');document.body.append(tip);
  const rect=cell.getBoundingClientRect(),half=tip.offsetWidth/2;
  const center=rect.left+rect.width/2;
  tip.style.left=Math.min(Math.max(center,TOOLTIP_EDGE+half),window.innerWidth-TOOLTIP_EDGE-half)+'px';
  tip.style.top=rect.top-8+'px';
  tooltip=tip;
 }
 function monthLabels(visible){
  const labels=new Array(visible.length).fill(null);
  let start=0;
  for(let i=1;i<=visible.length;i++){
   const month=weekMonth(visible[start]);
   if(i<visible.length&&weekMonth(visible[i])===month)continue;
   if(i-start>=3)labels[start]=MONTH_NAMES[month-1]||null;
   start=i;
  }
  return labels;
 }
 function weekMonth(week){return Number(week[0]?.date.slice(5,7));}
 function draw(){
  if(!weeks.length)return;
  const available=gridWidth.getBoundingClientRect().width;
  const cols=Math.max(1,Math.floor((available+GAP)/(CELL_SIZE+GAP)));
  if(cols===widthLast&&rendered)return;
  widthLast=cols;hideTooltip();
  const cap=Math.ceil(MONTHS*WEEKS_PER_MONTH);
  const visible=weeks.slice(-Math.min(cap,cols,weeks.length));
  monthRow.replaceChildren();weekRow.replaceChildren();
  const labels=monthLabels(visible);
  const shouldEnter=!rendered&&!reduced.matches;
  for(let index=0;index<visible.length;index++){
   const month=node('span','work-activity-month',labels[index]||'');
   month.style.width=CELL_SIZE+'px';
   monthRow.append(month);
   const column=node('div','work-activity-week');
   for(const day of visible[index]){
    const cell=node('span','work-activity-day');
    cell.style.backgroundColor=levels[day.level];
    cell.dataset.level=String(day.level);
    cell.title=dayDescription(day);
    cell.setAttribute('aria-label',dayDescription(day));
    cell.addEventListener('pointerenter',()=>showTooltip(day,cell));
    cell.addEventListener('focus',()=>showTooltip(day,cell));
    cell.addEventListener('blur',hideTooltip);
    cell.tabIndex=0;
    if(shouldEnter){
     cell.classList.add('work-activity-cell-enter');
     cell.style.animationDelay=index*COLUMN_STAGGER+'ms';
    }
    column.append(cell);
   }
   weekRow.append(column);
  }
  if(shouldEnter) {
   monthRow.classList.add('work-activity-month-enter');
   monthRow.style.animationDelay=((visible.length-1)*COLUMN_STAGGER+200)+'ms';
  } else monthRow.classList.remove('work-activity-month-enter');
  rendered=true;
 }
 function buildWeeks(data){
  const from=parseDay(data.windowStart),through=parseDay(data.windowEnd);
  if(!Number.isFinite(from)||!Number.isFinite(through)||through<from||through-from>370*DAY)throw Error('Invalid activity period.');
  const mapped=new Map();
  if(!Array.isArray(data.days)||!Array.isArray(data.projects))throw Error('Invalid activity summary.');
  for(const item of data.days){
   const timestamp=parseDay(item.date);
   if(!Number.isFinite(timestamp)||timestamp<from||timestamp>through||!Number.isSafeInteger(item.count)||item.count<0)throw Error('Invalid daily activity.');
   mapped.set(item.date,(mapped.get(item.date)||0)+item.count);
  }
  const start=from-new Date(from).getUTCDay()*DAY,all=[];
  for(let t=start;t<=through;t+=DAY){
   const day=escapeDateKey(t),count=t<from?0:mapped.get(day)||0;
   all.push({date:day,count,level:count===0?0:count===1?1:count<=3?2:count<=6?3:4});
  }
  weeks=[];
  for(let i=0;i<all.length;i+=7)weeks.push(all.slice(i,i+7));
  projects=data.projects.slice(0,STACK_LIMIT).map(p=>{
   if(typeof p.name!=='string'||!Number.isSafeInteger(p.count)||p.count<0)throw Error('Invalid project activity.');
   return {name:p.name,count:p.count};
  });
 }
 function initials(name){return name.trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'•';}
 function setOpen(next){
  open=next&&projects.length>0;
  drawer.classList.toggle('work-activity-open',open);
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Hide top projects':'Show top projects');
  projectsList.setAttribute('aria-hidden',String(!open));
  projectsList.inert=!open;
 }
 function drawProjects(){
  avatars.replaceChildren();projectsList.replaceChildren();
  for(const p of projects){
   const avatar=node('span','work-activity-avatar',initials(p.name));
   avatar.title=p.name;avatars.append(avatar);
   const item=node('li','work-activity-project');
   const badge=node('span','work-activity-project-avatar',initials(p.name));
   const title=node('span','work-activity-project-name',p.name);
   const count=node('span','work-activity-project-count',p.count);
   item.append(badge,title,count);projectsList.append(item);
  }
  if(!projects.length)drawerLabel.textContent='No recorded task completions yet';
  else drawerLabel.textContent='Top projects';
  toggle.disabled=!projects.length;avatars.hidden=!projects.length;
  setOpen(false);
 }
 async function load(){
  const current=++request;
  try{
   const response=await fetch('/api/hrms/me/activity',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(response.status===401){location.assign('/login');return;}
   if(!response.ok)throw Error('Activity history is temporarily unavailable.');
   const data=await response.json();
   if(current!==request)return;
   buildWeeks(data);
   const total=Number(data.total);
   if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid task total.');
   header.textContent=total+' recorded task completion'+(total===1?'':'s')+' · Last 12 months';
   card.setAttribute('aria-label',header.textContent);
   card.style.setProperty('--activity-ideal-min-width',MIN_CARD_WIDTH+'px'); // Responsive down to smaller screens.
   rendered=false;widthLast=-1;
   drawProjects();draw();
   root.dataset.state='loaded';
  }catch(error){
   if(current!==request)return;
   hideTooltip();root.dataset.state='error';
   header.textContent='Task activity is unavailable. Refresh to retry.';
   monthRow.replaceChildren();weekRow.replaceChildren();projectsList.replaceChildren();avatars.replaceChildren();
   drawerLabel.textContent='Activity unavailable';toggle.disabled=true;setOpen(false);
  }
 }
 toggle.addEventListener('click',()=>setOpen(!open));
 weekRow.addEventListener('pointerleave',hideTooltip);
 window.addEventListener('scroll',hideTooltip,{passive:true});
 window.addEventListener('resize',hideTooltip,{passive:true});
 if('ResizeObserver' in window){
  new ResizeObserver(()=>draw()).observe(gridWidth);
 }else window.addEventListener('resize',draw,{passive:true});
 window.VSPHWorkActivity={load};
})();
