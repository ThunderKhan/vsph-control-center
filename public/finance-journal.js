(() => {
 'use strict';
 const $=id=>document.getElementById(id),form=$('journalFilters');
 let generation=0,controller=null,filters={kind:'invoices',status:'all'},position=null,history=[],next=null,loaded=false,attempt={cursor:null,history:[]};
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=String(text);return element;};
 const money=value=>{if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,99})$/.test(value))throw Error('Invalid journal amount.');const n=BigInt(value);return '₹'+(n/100n).toLocaleString('en-IN')+'.'+(n%100n).toString().padStart(2,'0');};
 function statusOptions(){const kind=form.elements.kind.value,select=form.elements.status;select.replaceChildren();for(const value of ['all',...(kind==='invoices'?['issued','void']:['active','reversed'])]){const option=node('option',value==='all'?'All statuses':value);option.value=value;select.append(option);}}
 function draw(data){
  if(!Array.isArray(data.items)||data.items.length>25||!(data.nextCursor===null||typeof data.nextCursor==='object'&&!Array.isArray(data.nextCursor)))throw Error('Invalid journal response.');
  const columns=filters.kind==='invoices'?['Reference','Customer / project','Invoiced','Collected','Outstanding','Issued / due','Status']:['Receipt / invoice','Customer / project','Amount','Received','Status'];
  const table=node('table'),head=node('thead'),headRow=node('tr'),body=node('tbody');
  for(const label of columns){const cell=node('th',label);cell.scope='col';headRow.append(cell);}head.append(headRow);
  for(const item of data.items){
   const row=node('tr');let values;
   if(filters.kind==='invoices'){
    if(!['issued','void'].includes(item.status))throw Error('Invalid journal status.');
    const billed=money(item.amount_paise),paid=money(item.collected_paise),balance=BigInt(item.amount_paise)-BigInt(item.collected_paise);if(balance<0n)throw Error('Invalid journal balance.');
    values=[item.reference,item.organization_name+' / '+(item.project_name||'No project'),billed,paid,item.status==='issued'?money(balance.toString()):'—',item.issued_on+' / '+item.due_on,item.status];
   }else{if(typeof item.reversed!=='boolean')throw Error('Invalid receipt status.');values=[item.payment_reference+' / '+item.invoice_reference,item.organization_name+' / '+(item.project_name||'No project'),money(item.amount_paise),item.received_on,item.reversed?'Reversed':'Recorded'];}
   for(const value of values)row.append(node('td',value));body.append(row);
  }
  if(!data.items.length){const row=node('tr'),cell=node('td','No matching records.');cell.colSpan=columns.length;row.append(cell);body.append(row);}
  table.append(head,body);$('journalResult').replaceChildren(table);
 }
 async function load(cursor=null,back=[]){
  const ticket=++generation;controller?.abort();controller=new AbortController();const current=controller;
  attempt={cursor,history:back};loaded=false;next=null;$('journalPrevious').disabled=true;$('journalNext').disabled=true;$('journalRetry').disabled=true;
  $('journalResult').replaceChildren(node('p','Loading…'));$('journalResult').setAttribute('aria-busy','true');$('journalPage').textContent='—';$('journalStatus').textContent='Loading journal…';
  const params=new URLSearchParams(filters);if(cursor)params.set('cursor',JSON.stringify(cursor));
  const timer=setTimeout(()=>current.abort(),12000);
  try{
   const response=await fetch('/api/finance/journal?'+params,{credentials:'same-origin',cache:'no-store',signal:current.signal});
   if(ticket!==generation)return;
   if(response.status===401){location.assign('/login');throw Error('Please sign in again.');}
   if(response.status===403)throw Error('Owner access is no longer available.');
   const data=await response.json();if(ticket!==generation)return;
   if(!response.ok)throw Error(data.code==='SCHEMA_NOT_READY'?'The finance journal database migration is required. Contact the database operator.':response.status===400?'Invalid or outdated filters/cursor. Apply filters to restart from the first page.':'Journal unavailable. Retry this page.');
   draw(data);position=cursor;history=back;next=data.nextCursor;loaded=true;
   $('journalPage').textContent='Page '+(history.length+1);$('journalStatus').textContent=data.items.length+' matching records on this page. Amounts are recorded INR cash-ledger data.';
  }catch(error){if(ticket!==generation)return;$('journalResult').replaceChildren();$('journalStatus').textContent=error.name==='AbortError'?'Journal request timed out. Retry this page.':error.message||'Journal unavailable.';}
  finally{clearTimeout(timer);if(ticket===generation){$('journalResult').setAttribute('aria-busy','false');$('journalRetry').disabled=false;$('journalPrevious').disabled=!loaded||history.length===0;$('journalNext').disabled=!loaded||!next;}}
 }
 form.elements.kind.addEventListener('change',statusOptions);
 form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));filters={};for(const [key,value] of Object.entries(values)){const text=value.trim();if(text)filters[key]=text;}if(filters.from&&filters.to&&filters.from>filters.to){controller?.abort();generation++;loaded=false;next=null;$('journalResult').replaceChildren();$('journalStatus').textContent='From date must not be later than To date.';$('journalResult').setAttribute('aria-busy','false');$('journalPrevious').disabled=true;$('journalNext').disabled=true;$('journalRetry').disabled=true;return;}void load();});
 $('journalNext').addEventListener('click',()=>{if(loaded&&next)void load(next,[...history,position]);});
 $('journalPrevious').addEventListener('click',()=>{if(loaded&&history.length)void load(history.at(-1),history.slice(0,-1));});
 $('journalRetry').addEventListener('click',()=>void load(attempt.cursor,attempt.history));
 void load();
})();
