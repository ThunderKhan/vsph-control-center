/* Owner-only presentation. The API and finance_report enforce authorization. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let initialized=false,loading=false,accessLost=false,operationEpoch=0;
 const money=value=>typeof value==='string'&&/^(0|[1-9][0-9]{0,99})$/.test(value);
 const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 const amount=value=>{const n=BigInt(value);return '₹'+(n/100n).toLocaleString('en-IN')+'.'+(n%100n).toString().padStart(2,'0');};
 function validate(report){
  if(!report||report.currency!=='INR'||report.basis!=='manual_cash_receipts'||!date(report.asOf)||!report.summary||!Array.isArray(report.monthly)||report.monthly.length!==6)throw Error('invalid');
  const summary=report.summary;
  for(const key of ['invoicedPaise','collectedPaise','outstandingPaise','pastDuePaise'])if(!money(summary[key]))throw Error('invalid');
  for(const key of ['issuedInvoices','voidInvoices','clients','projects'])if(!Number.isSafeInteger(summary[key])||summary[key]<0)throw Error('invalid');
  if(BigInt(summary.invoicedPaise)!==BigInt(summary.collectedPaise)+BigInt(summary.outstandingPaise)||BigInt(summary.pastDuePaise)>BigInt(summary.outstandingPaise))throw Error('invalid');
  let previous=null;
  for(const month of report.monthly){
   if(!date(month.month_start)||!month.month_start.endsWith('-01')||!money(month.collected_paise))throw Error('invalid');
   const current=new Date(month.month_start+'T00:00:00Z');
   if(previous){previous.setUTCMonth(previous.getUTCMonth()+1);if(previous.getTime()!==current.getTime())throw Error('invalid');}
   previous=current;
  }
  if(report.monthly.at(-1).month_start.slice(0,7)!==report.asOf.slice(0,7))throw Error('invalid');
 }
 function clear(){
  $('ownerOverviewFacts').hidden=true;
  for(const id of ['ownerInvoiced','ownerCollected','ownerOutstanding','ownerPastDue'])$(id).textContent='—';
  $('ownerOverviewMonths').replaceChildren();$('ownerOverviewCounts').textContent='';$('ownerOverviewObserved').textContent='';
 }
 function render(report){
  const summary=report.summary;
  for(const [id,key] of Object.entries({ownerInvoiced:'invoicedPaise',ownerCollected:'collectedPaise',ownerOutstanding:'outstandingPaise',ownerPastDue:'pastDuePaise'}))$(id).textContent=amount(summary[key]);
  const maximum=report.monthly.reduce((n,x)=>BigInt(x.collected_paise)>n?BigInt(x.collected_paise):n,0n);
  const list=$('ownerOverviewMonths');
  for(const entry of report.monthly){
   const row=document.createElement('li'),label=document.createElement('span'),track=document.createElement('span'),bar=document.createElement('span'),value=document.createElement('strong');
   label.textContent=entry.month_start.slice(0,7);value.textContent=amount(entry.collected_paise);
   track.className='owner-month-track';track.setAttribute('aria-hidden','true');
   bar.style.width=(maximum?Number(BigInt(entry.collected_paise)*10000n/maximum)/100:0)+'%';
   track.append(bar);row.append(label,track,value);list.append(row);
  }
  const count=(n,label)=>n.toLocaleString('en-IN')+' '+label+(n===1?'':'s');
  $('ownerOverviewCounts').textContent=count(summary.issuedInvoices,'issued invoice')+' · '+count(summary.voidInvoices,'void invoice')+' · '+count(summary.clients,'customer')+' with issued invoices · '+count(summary.projects,'project')+' with issued invoices';
  $('ownerOverviewObserved').textContent='Ledger date '+report.asOf+' · Retrieved '+new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
  $('ownerOverviewFacts').hidden=false;
 }
 const operationIds=['ownerActiveCustomers','ownerActiveProjects','ownerActiveEmployees','ownerActiveProducts','ownerCustomerTotal','ownerCustomerActive','ownerCustomerSuspended','ownerEmployeeTotal','ownerEmployeeOnboarding','ownerProductTotal'];
 function clearOperations(){
  for(const id of operationIds)$(id).textContent='—';
  $('ownerRecentProjects').replaceChildren();$('ownerTaskProgress').hidden=true;
  $('ownerDeliverySummary').textContent='Project records are unavailable.';
  $('ownerCustomersStatus').textContent='Customer records are unavailable.';
  $('ownerPeopleStatus').textContent='Workforce and product records are unavailable.';
 }
 function validateOperations(report){
  for(const [name,keys] of Object.entries({customers:['total','active','suspended'],delivery:['active','completed','tasks','done','cancelled','blocked'],workforce:['total','active','onboarding'],products:['total','active']})){
   const section=report?.[name];if(!section||!['ready','unavailable'].includes(section.status))throw Error('invalid');
   if(section.status==='ready')for(const key of keys)if(!Number.isSafeInteger(section[key])||section[key]<0)throw Error('invalid');
  }
  if(report.delivery.status==='ready'){
   const d=report.delivery;
   if(d.done+d.cancelled>d.tasks||d.blocked>d.tasks||!Array.isArray(d.recent)||d.recent.length>6)throw Error('invalid');
   for(const p of d.recent)if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)||typeof p.name!=='string'||p.name.length>200||!['internal','customer'].includes(p.kind)||p.status!=='active')throw Error('invalid');
  }
 }
 function renderOperations(report){
  const set=(id,n)=>{$(id).textContent=n.toLocaleString('en-IN');};
  const {customers:c,delivery:d,workforce:w,products:p}=report;
  if(c.status==='ready'){
   set('ownerActiveCustomers',c.active);set('ownerCustomerTotal',c.total);set('ownerCustomerActive',c.active);set('ownerCustomerSuspended',c.suspended);
   $('ownerCustomersStatus').textContent='Recorded organization lifecycle states. Closed organizations remain included in the total.';
  }
  if(d.status==='ready'){
   set('ownerActiveProjects',d.active);
   const total=d.tasks-d.cancelled;
   $('ownerDeliverySummary').textContent=d.done.toLocaleString('en-IN')+' of '+total.toLocaleString('en-IN')+' noncancelled tasks completed · '+d.blocked.toLocaleString('en-IN')+' blocked · '+d.completed.toLocaleString('en-IN')+' completed projects.';
   if(total){$('ownerTaskProgress').value=100*d.done/total;$('ownerTaskProgress').hidden=false;}
   for(const p of d.recent){const row=document.createElement('li'),link=document.createElement('a'),kind=document.createElement('small');link.href='/projects/'+p.id;link.textContent=p.name;kind.textContent=p.kind==='internal'?'Internal':'Customer';row.append(link,kind);$('ownerRecentProjects').append(row);}
   if(!d.recent.length){const row=document.createElement('li');row.textContent='No active projects recorded. Create a project to start tracking delivery.';$('ownerRecentProjects').append(row);}
  }
  if(w.status==='ready'){set('ownerActiveEmployees',w.active);set('ownerEmployeeTotal',w.total);set('ownerEmployeeOnboarding',w.onboarding);}
  if(p.status==='ready'){set('ownerActiveProducts',p.active);set('ownerProductTotal',p.total);}
  $('ownerPeopleStatus').textContent=w.status==='ready'&&p.status==='ready'?'Counts from the internal employee roster and product registry.':w.status==='ready'?'Employee records loaded; product registry is unavailable.':p.status==='ready'?'Product registry loaded; employee records are unavailable.':'Workforce and product records are unavailable.';
  $('ownerOperationsStatus').textContent=[c,d,w,p].every(x=>x.status==='ready')?'Operating records loaded. Each section is read independently.':'Some operating sections are unavailable. Available records remain visible.';
 }
 async function refreshOperations(epoch){
  clearOperations();$('ownerOperationsStatus').textContent='Loading operating records…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/admin-management/dashboard',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(epoch!==operationEpoch)return;
   if(response.status===401){accessLost=true;clear();window.location.replace('/login');throw Error('denied');}
   if(response.status===403){accessLost=true;clear();throw Error('denied');}
   if(!response.ok||accessLost)throw Error('unavailable');
   const report=await response.json();
   if(epoch!==operationEpoch)return;
   if(accessLost)throw Error('denied');
   validateOperations(report);renderOperations(report);
  }catch{if(epoch!==operationEpoch)return;clearOperations();$('ownerOperationsStatus').textContent=accessLost?'Owner access is no longer available. Sign in again.':'Operating records are unavailable. Use Refresh overview to retry; finance is loaded separately.';}
  finally{clearTimeout(timer);}
 }
 async function refresh(){
  if(loading)return;
  loading=true;accessLost=false;void refreshOperations(++operationEpoch);clear();$('ownerOverview').dataset.state='loading';$('ownerOverviewFacts').setAttribute('aria-busy','true');$('ownerOverviewRefresh').disabled=true;
  $('ownerOverviewStatus').textContent='Loading recorded balances…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/finance/overview',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401){accessLost=true;clearOperations();window.location.replace('/login');throw Error('session');}
   if(response.status===403){accessLost=true;clearOperations();throw Error('denied');}
   const report=await response.json();
   if(!response.ok){if(response.status===503&&report.code==='SCHEMA_NOT_READY')throw Error('schema');throw Error('unavailable');}
   if(accessLost)throw Error('denied');validate(report);render(report);$('ownerOverview').dataset.state='ready';
   $('ownerOverviewStatus').textContent='Recorded balances loaded from the finance ledger. Refresh to retrieve later changes.';
  }catch(error){
   clear();$('ownerOverview').dataset.state='error';
   $('ownerOverviewStatus').textContent=error.message==='denied'?'Owner finance access is no longer available. Recorded balances have been cleared.':
    error.message==='schema'?'The finance database upgrade is required. Operating records above are loaded independently; the finance ledger and report migrations must be installed to show balances.':
    error.message==='session'?'Your session has expired. Please sign in again.':
    error.name==='AbortError'?'The overview request timed out. Retry with Refresh overview.':
    'Recorded balances are unavailable. Retry with Refresh overview; no balances are estimated.';
  }finally{clearTimeout(timer);loading=false;$('ownerOverviewRefresh').disabled=false;$('ownerOverviewFacts').setAttribute('aria-busy','false');}
 }
 function activate(){
  if(!/^\/dashboard\/?$/.test(window.location.pathname)||!$('ownerOverview'))return false;
  $('ownerOverview').hidden=false;document.documentElement.dataset.ownerOverview='true';document.title='Owner dashboard | VSPH Control Center';
  if(!initialized){initialized=true;$('ownerOverviewRefresh').addEventListener('click',refresh);void refresh();}
  return true;
 }
 window.VSPHOwnerOverview=Object.freeze({activate});
})();
