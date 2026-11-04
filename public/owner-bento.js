/* Presentation adapted from the supplied Web3Bento composition. VSPH data only.
   No demo walks, synthetic metrics, simulated timers, wallet UI or React runtime. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 const money=value=>{const n=BigInt(value);return '₹'+(n/100n).toLocaleString('en-IN')+'.'+(n%100n).toString().padStart(2,'0');};
 const num=value=>value.toLocaleString('en-IN');
 const text=(id,value)=>{$(id).textContent=value;};
 const empty=(parent,message)=>{const row=document.createElement('li');row.className='owner-empty';row.textContent=message;$(parent).replaceChildren(row);};
 const day=value=>new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
 const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 let report=null,range=6,cardNodes=[],cardOrder=[];
 function clearFinance(){
  report=null;
  for(const id of ['ownerCashPulse','ownerCashChart','ownerChartMonths'])$(id).replaceChildren();
  text('ownerTrendTotal','—');text('ownerPulseCaption','Six calendar months of recorded receipts');
  text('ownerChartSelection','Select a month to inspect its recorded receipts.');
  text('ownerChartEmpty','Finance records are not loaded.');$('ownerChartEmpty').hidden=false;
  $('ownerCashChart').setAttribute('aria-label','Cash collection records are unavailable');
 }
 function svg(tag,attributes){
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));
  return node;
 }
 function renderTrend(){
  if(!report)return;
  const months=report.monthly.slice(-range),total=months.reduce((sum,m)=>sum+BigInt(m.collected_paise),0n);
  const max=months.reduce((n,m)=>BigInt(m.collected_paise)>n?BigInt(m.collected_paise):n,0n);
  const points=months.map((m,i)=>[months.length===1?320:20+i*600/(months.length-1),200-(max?Number(BigInt(m.collected_paise)*10000n/max)/10000*160:0)]);
  const chart=$('ownerCashChart');chart.replaceChildren();
  for(const y of [40,120,200])chart.append(svg('line',{x1:20,x2:620,y1:y,y2:y,class:'owner-chart-grid'}));
  const path=points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ');
  if(points.length>1){chart.append(svg('path',{d:path+' L620 200 L20 200 Z',class:'owner-chart-area'}));chart.append(svg('path',{d:path,class:'owner-chart-line'}));}
  const marker=svg('circle',{r:5,class:'owner-chart-point'});chart.append(marker);
  chart.setAttribute('aria-label',money(total)+' collected across '+months.length+' calendar month'+(months.length===1?'':'s'));
  text('ownerTrendTotal',money(total));text('ownerChartPeriod',months.length===1?'Current calendar month':'Last '+months.length+' calendar months');
  text('ownerChartEmpty','No cash receipts recorded in this period.');$('ownerChartEmpty').hidden=total!==0n;
  const labels=$('ownerChartMonths');labels.replaceChildren();
  const buttons=[];
  function select(index){
   const entry=months[index];marker.setAttribute('cx',points[index][0]);marker.setAttribute('cy',points[index][1]);
   for(let i=0;i<buttons.length;i++)buttons[i].setAttribute('aria-pressed',String(i===index));
   text('ownerChartSelection',new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(entry.month_start+'T00:00:00Z'))+' · '+money(entry.collected_paise)+' collected');
  }
  months.forEach((m,index)=>{
   const button=document.createElement('button');button.type='button';
   button.textContent=new Intl.DateTimeFormat('en-IN',{month:'short',timeZone:'UTC'}).format(new Date(m.month_start+'T00:00:00Z'));
   button.setAttribute('aria-label',m.month_start.slice(0,7)+': '+money(m.collected_paise)+' collected');
   button.addEventListener('click',()=>select(index));button.addEventListener('focus',()=>select(index));button.addEventListener('pointerenter',()=>select(index));
   buttons.push(button);labels.append(button);
  });
  select(months.length-1);
 }
 function finance(data){
  report=data;renderTrend();
  const max=data.monthly.reduce((n,m)=>BigInt(m.collected_paise)>n?BigInt(m.collected_paise):n,0n),pulse=$('ownerCashPulse');pulse.replaceChildren();
  for(const m of data.monthly){const bar=document.createElement('span');bar.style.height=(max?Number(BigInt(m.collected_paise)*10000n/max)/100:0)+'%';pulse.append(bar);}
  text('ownerPulseCaption',max?'Monthly cash collections · last six calendar months':'No receipts recorded in the last six calendar months');
 }
 function clearOperations(){
  for(const id of ['ownerCompletionPercent','ownerCompletedProjects','ownerBlockedCount','ownerOpenTasks','ownerWorkDone','ownerWorkOpen','ownerWorkBlocked','ownerTeamActive','ownerTeamOther','ownerOverdueTasks','ownerOverdueMilestones'])text(id,'—');
  for(const id of ['ownerWorkloadBar','ownerPeopleMarks','ownerProductCards'])$(id).replaceChildren();
  cardNodes=[];cardOrder=[];
  $('ownerGaugeFill').setAttribute('stroke-dasharray','0 100');$('ownerGaugeFill').style.opacity='0';
  $('ownerCompletionGauge').setAttribute('aria-label','Task completion records are unavailable');
  text('ownerCompletionCaption','Task records are not loaded');text('ownerCatalogStatus','Product registry is not loaded');
  empty('ownerUpcomingMilestones','Milestone records are not loaded.');empty('ownerActivityItems','Project history is not loaded.');
 }
 function catalog(products){
  if(products.status!=='ready')return;
  const list=products.catalog;
  if(!Array.isArray(list)||list.length>3||list.some(p=>!uuid(p.id)||typeof p.name!=='string'||!p.name.length||!/^([A-Z][A-Z0-9_]{1,39})$/.test(p.code)||!['active','disabled','maintenance','retired'].includes(p.status))){text('ownerCatalogStatus','Product cards are unavailable');return;}
  text('ownerCatalogStatus',list.length?'Select a product card':'No products registered');
  if(!list.length){const p=document.createElement('p');p.className='owner-caption';p.textContent='Register a product to build your portfolio.';$('ownerProductCards').append(p);return;}
  cardOrder=list.map(p=>p.id);
  const arrange=()=>{
   for(const node of cardNodes){const index=cardOrder.indexOf(node.dataset.productId),back=cardOrder.length-1-index;node.style.top=(index*48)+'px';node.style.zIndex=String(index+1);node.style.transform='scale('+(1-back*.045)+')';node.setAttribute('aria-pressed',String(back===0));}
  };
  for(const p of list){
   const card=document.createElement('button'),code=document.createElement('span'),name=document.createElement('strong'),state=document.createElement('small');
   card.type='button';card.className='owner-product-card';card.dataset.productId=p.id;card.setAttribute('aria-label',p.name+' product card');
   code.textContent=p.code;name.textContent=p.name;state.textContent=p.status.charAt(0).toUpperCase()+p.status.slice(1);
   card.append(code,name,state);card.addEventListener('click',()=>{cardOrder=[...cardOrder.filter(id=>id!==p.id),p.id];arrange();});
   cardNodes.push(card);$('ownerProductCards').append(card);
  }
  $('ownerProductCards').style.minHeight=(140+(list.length-1)*48)+'px';arrange();
 }
 function delivery(d){
  if(d.status!=='ready')return;
  const total=d.tasks-d.cancelled,open=total-d.done,other=open-d.blocked;
  if(other<0)return;
  const percent=total?100*d.done/total:null;
  text('ownerCompletionPercent',percent===null?'—':percent.toFixed(0)+'%');
  text('ownerCompletionCaption',total?num(d.done)+' of '+num(total)+' noncancelled tasks completed':'No tasks recorded');
  $('ownerGaugeFill').setAttribute('stroke-dasharray',(percent??0)+' 100');$('ownerGaugeFill').style.opacity=percent?'1':'0';
  $('ownerCompletionGauge').setAttribute('aria-label',total?num(d.done)+' of '+num(total)+' noncancelled tasks completed':'No tasks recorded; completion percentage is unavailable');
  text('ownerCompletedProjects',num(d.completed));text('ownerBlockedCount',num(d.blocked));text('ownerOpenTasks',num(open));
  text('ownerWorkDone',num(d.done));text('ownerWorkBlocked',num(d.blocked));text('ownerWorkOpen',num(other));
  for(const [count,color] of [[d.done,'#00255A'],[other,'#9DB5C8'],[d.blocked,'#50C0E8']])if(count){const segment=document.createElement('span');segment.style.flex=count+' 1 0';segment.style.background=color;$('ownerWorkloadBar').append(segment);}
 }
 function people(w){
  if(w.status!=='ready')return;
  text('ownerTeamActive',num(w.active));text('ownerTeamOther',num(w.total-w.active-w.onboarding));
  let remaining=16;
  for(const [count,kind] of [[w.active,'active'],[w.onboarding,'onboarding'],[w.total-w.active-w.onboarding,'other']]){
   const shown=Math.min(count,remaining);for(let i=0;i<shown;i++){const cell=document.createElement('span');cell.dataset.kind=kind;$('ownerPeopleMarks').append(cell);}remaining-=shown;
  }
 }
 function attention(a){
  if(a?.status!=='ready'||!integer(a.overdueTasks)||!integer(a.overdueMilestones)||!validDay(a.asOf)||!Array.isArray(a.upcoming)||a.upcoming.length>5)return;
  if(a.upcoming.some(m=>!uuid(m.projectId)||!uuid(m.id)||typeof m.title!=='string'||!validDay(m.dueOn)||!['planned','active'].includes(m.status)))return;
  text('ownerOverdueTasks',num(a.overdueTasks));text('ownerOverdueMilestones',num(a.overdueMilestones));text('ownerAttentionDate','As of '+day(a.asOf));
  $('ownerUpcomingMilestones').replaceChildren();
  for(const m of a.upcoming){const row=document.createElement('li'),link=document.createElement('a'),title=document.createElement('span'),time=document.createElement('time');link.href='/projects/'+m.projectId;title.textContent=m.title;time.textContent=day(m.dueOn);time.setAttribute('datetime',m.dueOn);link.append(title,time);row.append(link);$('ownerUpcomingMilestones').append(row);}
  if(!a.upcoming.length)empty('ownerUpcomingMilestones','No dated milestones coming up. Add a milestone to plan your next delivery.');
 }
 function activity(a){
  if(a?.status!=='ready'||!Array.isArray(a.items)||a.items.length>6)return;
  if(a.items.some(i=>!uuid(i.projectId)||typeof i.action!=='string'||!Number.isFinite(Date.parse(i.createdAt))))return;
  $('ownerActivityItems').replaceChildren();
  const labels={'project.created':'Project created','project.create':'Project created','update':'Project updated','project.update':'Project updated','task.create':'Task created','task.update':'Task updated','milestone.create':'Milestone created','milestone.update':'Milestone updated','member.save':'Project membership updated','member.upsert':'Project membership updated','member.revoke':'Project membership revoked','comment.create':'Comment added','deliverable.create':'Deliverable added'};
  for(const item of a.items){const row=document.createElement('li'),link=document.createElement('a'),time=document.createElement('time');link.href='/projects/'+item.projectId;link.textContent=labels[item.action]||'Project activity';time.textContent=new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(item.createdAt));time.setAttribute('datetime',item.createdAt);row.append(link,time);$('ownerActivityItems').append(row);}
  if(!a.items.length)empty('ownerActivityItems','Your project history starts here. Updates appear as your team creates and delivers work.');
 }
 function operations(data){catalog(data.products);delivery(data.delivery);people(data.workforce);attention(data.attention);activity(data.activity);}
 function initialize(){
  for(const button of document.querySelectorAll('[data-owner-range]'))button.addEventListener('click',()=>{
   range=Number(button.dataset.ownerRange);
   for(const other of document.querySelectorAll('[data-owner-range]'))other.setAttribute('aria-pressed',String(other===button));
   renderTrend();
  });
 }
 initialize();window.VSPHOwnerBento=Object.freeze({finance,operations,clearFinance,clearOperations});
})();
