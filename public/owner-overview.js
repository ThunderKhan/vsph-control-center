/* Owner-only presentation. The API and finance_report enforce authorization. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let initialized=false,loading=false;
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
  $('ownerOverviewCounts').textContent=summary.issuedInvoices.toLocaleString('en-IN')+' issued invoices · '+summary.voidInvoices.toLocaleString('en-IN')+' void invoices · '+summary.clients.toLocaleString('en-IN')+' customers with issued invoices · '+summary.projects.toLocaleString('en-IN')+' projects with issued invoices';
  $('ownerOverviewObserved').textContent='Ledger date '+report.asOf+' · Retrieved '+new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
  $('ownerOverviewFacts').hidden=false;
 }
 async function refresh(){
  if(loading)return;
  loading=true;clear();$('ownerOverview').dataset.state='loading';$('ownerOverviewFacts').setAttribute('aria-busy','true');$('ownerOverviewRefresh').disabled=true;
  $('ownerOverviewStatus').textContent='Loading recorded balances…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/finance/overview',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401){window.location.replace('/login');throw Error('session');}
   if(response.status===403)throw Error('denied');
   const report=await response.json();
   if(!response.ok){if(response.status===503&&report.code==='SCHEMA_NOT_READY')throw Error('schema');throw Error('unavailable');}
   validate(report);render(report);$('ownerOverview').dataset.state='ready';
   $('ownerOverviewStatus').textContent='Recorded balances loaded from the finance ledger. Refresh to retrieve later changes.';
  }catch(error){
   clear();$('ownerOverview').dataset.state='error';
   $('ownerOverviewStatus').textContent=error.message==='denied'?'Owner finance access is no longer available. Recorded balances have been cleared.':
    error.message==='schema'?'The finance database upgrade is required. An operator must review and install the ledger and exact-report migrations before this overview can load.':
    error.message==='session'?'Your session has expired. Please sign in again.':
    error.name==='AbortError'?'The overview request timed out. Retry with Refresh overview.':
    'Recorded balances are unavailable. Retry with Refresh overview; no balances are estimated.';
  }finally{clearTimeout(timer);loading=false;$('ownerOverviewRefresh').disabled=false;$('ownerOverviewFacts').setAttribute('aria-busy','false');}
 }
 function activate(){
  if(!/^\/dashboard\/?$/.test(window.location.pathname)||!$('ownerOverview'))return false;
  $('ownerOverview').hidden=false;document.documentElement.dataset.ownerOverview='true';document.title='Operating overview | VSPH Control Center';
  if(!initialized){initialized=true;$('ownerOverviewRefresh').addEventListener('click',refresh);void refresh();}
  return true;
 }
 window.VSPHOwnerOverview=Object.freeze({activate});
})();
