(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);if(cls)el.className=cls;return el;};
 const fmt=n=>{
  const value=BigInt(n||0),whole=value/100n,part=(value%100n).toString().padStart(2,'0');
  return '₹'+whole.toLocaleString('en-IN')+'.'+part;
 };
 const rupeesToPaise=text=>{
  if(typeof text!=='string'||!/^[0-9]{1,10}(?:\.[0-9]{1,2})?$/.test(text))throw Error('Enter a positive INR amount with at most two decimal places.');
  const [whole,dec='']=text.split('.'),p=BigInt(whole)*100n+BigInt(dec.padEnd(2,'0'));
  if(p<=0n||p>1000000000000n)throw Error('The amount must be between ₹0.01 and ₹10,000,000,000.00.');
  return Number(p);
 };
 let report=null,lookups=null,selectedMonth=null,loading=false,pending={invoice:null,payment:null};
 const message=text=>{$('financeStatus').textContent=text;};
 async function api(path,body=null,headers={}){
  const response=await fetch('/api/finance'+path,{
   credentials:'same-origin',cache:'no-store',
   ...(body?{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}:{})
  });
  if(response.status===401){location.assign('/login');throw Error('Your session has expired.');}
  if(response.status===403){throw Error('Only the VSPH platform owner may access financial records.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.code==='SCHEMA_NOT_READY'
   ?'The finance database migration has not been installed. The database owner must review backups and apply it before use.'
   :data.message||'Financial operation failed. Reload to reconcile the ledger.');
  return data;
 }
 function option(value,label){const el=node('option',label);el.value=value;return el;}
 function drawOptions(){
  if(!lookups)return;
  const org=$('invoiceOrg');const prior=org.value;org.replaceChildren(option('','Select Customer'));
  for(const item of lookups.organizations)org.append(option(item.id,item.name));
  if(lookups.organizations.some(x=>x.id===prior))org.value=prior;
  org.dispatchEvent(new Event('change'));
 }
 function drawProjects(){
  const id=$('invoiceOrg').value,picker=$('invoiceProject');
  const prior=picker.value;picker.replaceChildren(option('','No Linked Project'));
  for(const pr of (lookups?.projects||[]).filter(x=>x.customer_organization_id===id))
   picker.append(option(pr.id,pr.name));
  if([...picker.options].some(x=>x.value===prior))picker.value=prior;
 }
 function showTotals(summary){
  const mapping={finInvoiced:'invoicedPaise',finCollected:'collectedPaise',finOutstanding:'outstandingPaise',finOverdue:'pastDuePaise'};
  for(const [id,key] of Object.entries(mapping))$(id).textContent=fmt(summary[key]);
  for(const [id,key] of Object.entries({finCount:'issuedInvoices',finVoided:'voidInvoices',finClients:'clients',finProjects:'projects'}))
   $(id).textContent=Number(summary[key]||0).toLocaleString('en-IN');
 }
 function drawMonths(items){
  const panel=$('financeMonths');panel.replaceChildren();
  const max=items.reduce((m,x)=>Math.max(m,Number(x.collected_paise||0)),0);
  for(const entry of items){
   const month=String(entry.month_start).slice(0,7),b=node('button',undefined,'finance-month');
   b.type='button';b.setAttribute('aria-pressed',String(selectedMonth===month));
   b.setAttribute('aria-label',month+': '+fmt(entry.collected_paise)+' collected');
   const chart=node('span',undefined,'finance-month-track'),bar=node('span',undefined,'finance-month-bar');
   bar.style.height=(max?Math.max(2,Math.min(100,Number(entry.collected_paise)/max*100)):2)+'%';
   chart.append(bar);
   b.append(chart,node('span',month),node('strong',fmt(entry.collected_paise)));
   b.addEventListener('click',()=>{selectedMonth=selectedMonth===month?null:month;drawMonths(items);
    message(selectedMonth?'Selected '+selectedMonth+' · '+fmt(entry.collected_paise)+' in recorded cash receipts.':'Showing all six collection months.');});
   panel.append(b);
  }
 }
 function rowsInto(id,items){
  const panel=$(id);panel.replaceChildren();
  if(!items.length){panel.append(node('p','No recorded collections yet.','finance-empty'));return;}
  const max=items.reduce((m,x)=>Math.max(m,Number(x.collected_paise||0)),0);
  for(const entry of items){
   const row=node('div',undefined,'finance-breakdown-row');
   const heading=node('div',undefined,'finance-breakdown-head');
   const name=entry.organization_name||entry.project_name;
   heading.append(node('span',name),node('strong',fmt(entry.collected_paise)));
   const track=node('div',undefined,'finance-breakdown-track'),bar=node('span');
   bar.style.width=(max?Number(entry.collected_paise)/max*100:0)+'%';
   track.append(bar);
   row.append(heading,track,node('small',fmt(entry.invoiced_paise)+' invoiced · '+fmt(entry.outstanding_paise)+' due'));
   if(entry.organization_id){
    const btn=node('button','Filter invoices for this client','finance-link');
    btn.type='button';btn.addEventListener('click',()=>{
     $('invoiceFilter').value=entry.organization_id;drawInvoices();$('finInvoicesTitle').scrollIntoView({block:'nearest'});
    });row.append(btn);
   }
   panel.append(row);
  }
 }
 const makeCell=(tr,value)=>{const td=node('td',value);tr.append(td);return td;};
 function drawInvoices(){
  const tbody=$('financeInvoiceRows');tbody.replaceChildren();
  const filter=$('invoiceFilter').value;
  const invoices=(report?.invoices||[]).filter(x=>filter==='all'||x.organization_id===filter);
  const picker=$('paymentInvoice'),current=picker.value;
  picker.replaceChildren(option('','Select Invoice'));
  for(const entry of report?.invoices||[]){
   const outstanding=BigInt(entry.amount_paise)-BigInt(entry.collected_paise||0);
   if(entry.status==='issued'&&outstanding>0n)picker.append(option(entry.id,entry.reference+' · '+fmt(outstanding)+' due'));
  }
  if([...picker.options].some(x=>x.value===current))picker.value=current;
  if(!invoices.length){const tr=node('tr');const td=makeCell(tr,'No invoices in this view.');td.colSpan=7;tbody.append(tr);return;}
  for(const entry of invoices){
   const tr=node('tr'),due=BigInt(entry.amount_paise)-BigInt(entry.collected_paise||0);
   makeCell(tr,entry.reference);
   const td=makeCell(tr,entry.organization_name);td.append(node('small',entry.project_name||'No linked project'));
   makeCell(tr,fmt(entry.amount_paise));makeCell(tr,fmt(entry.collected_paise));
   makeCell(tr,entry.status==='issued'?fmt(due):'—');
   makeCell(tr,entry.due_on+' · '+entry.status);
   const action=makeCell(tr,'');
   if(entry.status==='issued'){
    const btn=node('button','Void','finance-link');
    btn.type='button';btn.disabled=Number(entry.collected_paise)>0;
    btn.title=btn.disabled?'Reverse active receipts before voiding':'Void this invoice';
    btn.addEventListener('click',()=>voidInvoice(entry));action.append(btn);
   }tbody.append(tr);
  }
 }
 function drawReceipts(){
  const tbody=$('financePaymentRows');tbody.replaceChildren();
  if(!report?.payments?.length){const tr=node('tr');const td=makeCell(tr,'No receipts recorded.');td.colSpan=6;tbody.append(tr);return;}
  for(const p of report.payments){
   const tr=node('tr');
   makeCell(tr,p.payment_reference);makeCell(tr,p.invoice_reference);
   makeCell(tr,fmt(p.amount_paise));makeCell(tr,p.received_on);
   makeCell(tr,p.reversed?'Reversed':'Recorded');
   const action=makeCell(tr,'');
   if(!p.reversed){const btn=node('button','Reverse','finance-link');
    btn.type='button';btn.addEventListener('click',()=>reversePayment(p));action.append(btn);}
   tbody.append(tr);
  }
 }
 function draw(){
  showTotals(report.summary);drawMonths(report.monthly||[]);
  rowsInto('financeClients',report.byClient||[]);
  rowsInto('financeProjects',report.byProject||[]);
  const sel=$('invoiceFilter'),prior=sel.value;sel.replaceChildren(option('all','All Customers'));
  for(const row of report.byClient||[])sel.append(option(row.organization_id,row.organization_name));
  if([...sel.options].some(x=>x.value===prior))sel.value=prior;
  drawInvoices();drawReceipts();
 }
 async function refresh(){
  if(loading)return;
  loading=true;try{
   const [next,available]=await Promise.all([api('/'),api('/options')]);
   report=next;lookups=available;drawOptions();draw();
   message('Live ledger loaded. Amounts are computed from persisted records, not demo data.');
  }catch(e){message(e.message);}
  finally{loading=false;}
 }
 async function run(fn){
  if(loading)return;
  loading=true;
  try{await fn();}catch(e){message(e.message);}
  finally{loading=false;}
 }
 const requestKey=(kind,body)=>{
  const signature=JSON.stringify(body);
  if(pending[kind]?.signature!==signature)pending[kind]={signature,key:crypto.randomUUID()};
  return pending[kind].key;
 };
 const dateToday=()=>new Date().toISOString().slice(0,10);
 $('financeInvoiceForm').elements.issuedOn.value=dateToday();
 $('financeInvoiceForm').elements.dueOn.value=dateToday();
 $('financePaymentForm').elements.receivedOn.value=dateToday();
 $('invoiceOrg').addEventListener('change',drawProjects);
 $('invoiceFilter').addEventListener('change',drawInvoices);
 $('financeRefresh').addEventListener('click',refresh);
 $('financeInvoiceForm').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
  run(async()=>{
   const data={reference:form.elements.reference.value.trim(),organizationId:form.elements.organizationId.value,
    projectId:form.elements.projectId.value||null,amountPaise:rupeesToPaise(form.elements.amountRupees.value.trim()),
    issuedOn:form.elements.issuedOn.value,dueOn:form.elements.dueOn.value};
   if(data.dueOn<data.issuedOn)throw Error('The due date cannot precede the issue date.');
   if(!await VSPHUI.confirm('Create '+data.reference+' for '+fmt(data.amountPaise)+'? This records an invoice, not a payment.'))return;
   const key=requestKey('invoice',data);
   await api('/invoices',data,{'Idempotency-Key':key});
   pending.invoice=null;form.reset();form.elements.issuedOn.value=dateToday();form.elements.dueOn.value=dateToday();
   // refresh is called outside run's busy gate.
   report=await api('/');lookups=await api('/options');drawOptions();draw();
   message('Invoice saved and financial balances recalculated.');
  });
 });
 $('financePaymentForm').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
  run(async()=>{
   const invoice=form.elements.invoiceId.value;
   if(!invoice)throw Error('Choose an invoice with an outstanding balance.');
   const payload={reference:form.elements.reference.value.trim(),
    amountPaise:rupeesToPaise(form.elements.amountRupees.value.trim()),
    receivedOn:form.elements.receivedOn.value};
   if(payload.receivedOn>dateToday())throw Error('Cash cannot be recorded before it was received.');
   if(!await VSPHUI.confirm('Record '+fmt(payload.amountPaise)+' cash received against the selected invoice?'))return;
   const key=requestKey('payment',{invoice,...payload});
   await api('/invoices/'+encodeURIComponent(invoice)+'/payments',{...payload,idempotencyKey:key});
   pending.payment=null;form.reset();form.elements.receivedOn.value=dateToday();
   report=await api('/');draw();message('Receipt recorded and balances recalculated.');
  });
 });
 async function reversePayment(p){
  const reason=await VSPHUI.prompt('Reverse receipt '+p.payment_reference+'? Enter a correction reason (at least 8 characters).');
  if(!reason)return;
  if(!await VSPHUI.confirm('Reverse this recorded receipt? The correction will be audited.'))return;
  run(async()=>{await api('/payments/'+encodeURIComponent(p.id)+'/reverse',{reason,confirmed:true});
   report=await api('/');draw();message('Receipt reversed. Totals recalculated.');});
 }
 async function voidInvoice(i){
  const reason=await VSPHUI.prompt('Void invoice '+i.reference+'? Enter a reason (at least 8 characters).');
  if(!reason)return;
  if(!await VSPHUI.confirm('Void this invoice? Unreversed receipts prevent voiding.'))return;
  run(async()=>{await api('/invoices/'+encodeURIComponent(i.id)+'/void',{version:i.version,reason,confirmed:true});
   report=await api('/');draw();message('Invoice voided. Totals recalculated.');});
 }
 refresh();
})();