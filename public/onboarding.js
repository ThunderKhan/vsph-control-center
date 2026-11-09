(()=>{
'use strict';
const $=id=>document.getElementById(id);
const form=$('onboardingForm'), next=$('nextButton'), previous=$('previousButton');
const panels=[...document.querySelectorAll('.wizard-step')];
const steps=[...document.querySelectorAll('#stepList .step')];
const titles=['Organization details','Customer owner','Product access','Review and create'];
const state={step:0,busy:false,slugEdited:false,slugChecked:'',slugAvailable:null,
  apps:[],catalogLoaded:false,catalogLoading:false,catalogError:'',chosen:new Set(),plans:new Map(),
  requestKey:crypto.randomUUID(),created:null,attempted:false};
const slugify=value=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160);
const custom=()=>$('customOnly').checked;
const node=(tag,text,cls)=>{
 const e=document.createElement(tag);
 if(text!==undefined)e.textContent=String(text);
 if(cls)e.className=cls;
 return e;
};
function showError(text=''){
 $('wizardError').textContent=text;
 $('wizardError').hidden=!text;
}
function slugStatus(text='',status=''){
 $('slugStatus').textContent=text;
 $('slugStatus').dataset.state=status;
 $('orgSlug').setAttribute('aria-invalid',String(status==='unavailable'));
}
function values(){
 return {organizationName:$('orgName').value.trim(),slug:$('orgSlug').value.trim().toLowerCase(),
   adminName:$('adminName').value.trim(),adminEmail:$('adminEmail').value.trim().toLowerCase()};
}
function tomorrow(days=14){
 const date=new Date();date.setDate(date.getDate()+days);
 return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function selected(){
 return [...state.chosen].map(id=>{
  const plan=state.plans.get(id)||{planCode:'standard',status:'trial',endsAt:tomorrow()};
  return {applicationId:id,planCode:plan.planCode.trim().toLowerCase(),status:plan.status,
    endsAt:plan.endsAt?plan.endsAt+'T23:59:59.999Z':null};
 });
}
function errorForStep(step=state.step){
 const v=values();
 if(step===0){
  if(v.organizationName.length<2||v.organizationName.length>150||/[\u0000-\u001f\u007f]/.test(v.organizationName))
    return 'Enter a valid organization name (2–150 characters).';
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug)||v.slug.length>160)
    return 'Use lowercase letters, numbers and hyphens for the workspace identifier.';
  if(state.slugChecked===v.slug&&state.slugAvailable===false)return 'This workspace identifier is already in use.';
 }
 if(step===1){
  if(v.adminName.length<2||v.adminName.length>150)return 'Enter the customer owner’s full name.';
  if(!v.adminEmail||v.adminEmail.length>190||!$('adminEmail').checkValidity())
    return 'Enter a valid work email address for the customer owner.';
 }
 if(step===2&&!custom()){
  if(!state.catalogLoaded||state.catalogError)return 'Load the catalog to select the correct VSPH products.';
  if(!state.chosen.size)return 'Select at least one product, or choose Organization only.';
  for(const plan of selected()){
   if(!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(plan.planCode))
     return 'Check the plan code for '+nameFor(plan.applicationId)+'.';
   if(plan.status==='trial'&&!plan.endsAt)return 'Trial products require a future end date.';
   if(plan.endsAt&&(!Number.isFinite(Date.parse(plan.endsAt))||Date.parse(plan.endsAt)<=Date.now()))
     return 'Choose a future end date for '+nameFor(plan.applicationId)+'.';
  }
 }
 if(step===3&&!$('confirm').checked)return 'Review the information and confirm before creating the organization.';
 return '';
}
function nameFor(id){return state.apps.find(app=>app.id===id)?.name||'Product'}
async function request(url,options={}){
 let response;
 try{
  response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 }catch{
  throw Error('The connection could not be completed. Your original request may still have succeeded.');
 }
 if(response.status===401){location.assign('/login');throw Error('Sign in again.');}
 if(response.status===403)throw Error('Platform owner access is required. Sign in with an authorized account.');
 const body=await response.json().catch(()=>({}));
 if(!response.ok){
  const error=Error(body.message||'The request could not be completed.');
  error.status=response.status;
  throw error;
 }
 return body;
}
async function checkSlug(){
 const slug=values().slug;
 if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return false;
 if(slug===state.slugChecked&&state.slugAvailable!==null)return state.slugAvailable;
 slugStatus('Checking workspace identifier…');
 try{
  const result=await request('/api/admin-management/onboardings/availability?slug='+encodeURIComponent(slug));
  if(values().slug!==slug)return false;
  state.slugChecked=slug;
  state.slugAvailable=result.available===true;
  slugStatus(state.slugAvailable?'Identifier is available.':'This identifier is already taken.',
    state.slugAvailable?'available':'unavailable');
  return state.slugAvailable;
 }catch(error){
  if(values().slug===slug)slugStatus('Could not check availability. The server will verify when creating.');
  // This preflight is advisory: the database's unique constraint is authoritative.
  return true;
 }
}
function renderProductChoices(){
 const box=$('productChoices');
 box.replaceChildren();
 if(state.catalogLoading){box.append(node('p','Loading active products…','subtle'));return;}
 if(!state.apps.length){box.append(node('p',state.catalogLoaded?'No active catalog products are available. Choose Organization only.':'Product catalog is not loaded.','subtle'));return;}
 for(const app of state.apps){
  const label=node('label',undefined,'product-choice');
  const check=document.createElement('input');
  check.type='checkbox';check.value=app.id;check.checked=state.chosen.has(app.id);
  check.setAttribute('aria-label','Enable '+app.name);
  const info=node('span');info.append(node('strong',app.name),node('small',app.code));
  label.append(check,info);
  check.onchange=()=>{
   if(check.checked)state.chosen.add(app.id);
   else{state.chosen.delete(app.id);state.plans.delete(app.id);}
   renderSubscriptionCards();
   showError();
  };
  box.append(label);
 }
}
function renderSubscriptionCards(){
 const box=$('subscriptionCards');
 box.replaceChildren();
 for(const app of state.apps.filter(x=>state.chosen.has(x.id))){
  const initial=state.plans.get(app.id)||{planCode:'standard',status:'trial',endsAt:tomorrow()};
  state.plans.set(app.id,initial);
  const article=node('article',undefined,'subscription-card');
  article.append(node('h3',app.name));
  const fields=node('div',undefined,'subscription-fields');
  function field(label,control){
   const wrapper=node('div',undefined,'subscription-field');
   const text=node('label',label);text.htmlFor=control.id;
   wrapper.append(text,control);fields.append(wrapper);
  }
  const code=document.createElement('input');code.id='plan-'+app.id;code.maxLength=60;code.required=true;
  code.setAttribute('pattern','[a-z0-9][a-z0-9_-]{0,59}');code.value=initial.planCode;
  const status=document.createElement('select');status.id='status-'+app.id;
  for(const [v,label] of [['trial','Trial'],['active','Active']]){
   const option=node('option',label);option.value=v;status.append(option);
  }
  status.value=initial.status;
  const end=document.createElement('input');end.type='date';end.id='end-'+app.id;
  end.min=tomorrow(1);end.value=initial.endsAt;
  const save=()=>{
   if(status.value==='trial'&&!end.value)end.value=tomorrow();
   end.required=status.value==='trial';
   state.plans.set(app.id,{planCode:code.value.trim().toLowerCase(),status:status.value,endsAt:end.value});
   showError();
  };
  code.oninput=save;status.onchange=save;end.onchange=save;
  field('Plan code',code);field('Subscription state',status);field('End date',end);
  save();article.append(fields);box.append(article);
 }
}
async function loadCatalog(){
 if(state.catalogLoading||state.catalogLoaded)return;
 state.catalogLoading=true;state.catalogError='';
 renderProductChoices();
 try{
  const info=await request('/api/admin-management/lookups');
  state.apps=(Array.isArray(info.applications)?info.applications:[])
   .filter(app=>app&&app.status==='active'&&typeof app.id==='string'&&typeof app.name==='string');
  state.catalogLoaded=true;
 }catch(e){state.catalogError=e.message;}
 finally{
  state.catalogLoading=false;
  $('catalogError').hidden=!state.catalogError;
  $('catalogErrorText').textContent=state.catalogError;
  renderProductChoices();
  renderSubscriptionCards();
 }
}
function renderReview(){
 const box=$('reviewDetails');box.replaceChildren();
 const v=values();
 function row(title,lines,index){
  const article=node('article',undefined,'review-item');
  const head=node('div',undefined,'review-item-head');
  const label=node('strong',title);
  const edit=node('button','Edit','review-edit');edit.type='button';
  edit.setAttribute('aria-label','Edit '+title.toLowerCase());
  edit.onclick=()=>go(index,true);
  head.append(label,edit);
  article.append(head);
  for(const line of lines)article.append(node('p',line));
  box.append(article);
 }
 row('Organization',[v.organizationName,'Workspace: '+v.slug],0);
 row('Customer owner',[v.adminName,v.adminEmail,'Owner membership begins after invitation acceptance.'],1);
 row('Product access',custom()
   ? ['Organization only — no catalog subscription or product grant.']
   : selected().map(p=>nameFor(p.applicationId)+' · '+p.planCode+' · '+p.status+(p.endsAt?' · until '+p.endsAt.slice(0,10):'')),2);
}
function render(){
 panels.forEach((panel,i)=>panel.hidden=i!==state.step);
 steps.forEach((item,i)=>{
  item.classList.toggle('active',i===state.step);
  item.classList.toggle('done',i<state.step);
  if(i===state.step)item.setAttribute('aria-current','step');
  else item.removeAttribute('aria-current');
 });
 const number=state.step+1;
 $('stepIndicator').textContent='STEP '+number+' OF 4';
 $('progressPercent').textContent=number*25+'% COMPLETE';
 $('progressFill').style.width=number*25+'%';
 previous.disabled=state.busy||state.step===0;
 next.disabled=state.busy;
 next.textContent=state.busy?'Creating organization…':state.step===3?'Create organization':'Continue';
 $('catalogConfiguration').hidden=custom();
 if(state.step===2&&!custom())renderProductChoices();
 if(state.step===3)renderReview();
 showError();
}
function go(step,focus=false){
 if(state.busy)return;
 if(state.step===3&&step<3)$('confirm').checked=false;
 state.step=step;render();
 if(focus)panels[step].querySelector('legend')?.focus();
}
function showComplete(info){
 state.created=info;
 form.hidden=true;$('recoveryScreen').hidden=true;$('completeScreen').hidden=false;
 $('createdWorkspace').textContent=info.slug||values().slug;
 $('createdInvitation').textContent='Queued — not delivered';
 const count=Number.isInteger(info.productCount)?info.productCount:(custom()?0:selected().length);
 $('createdProducts').textContent=count?count+' catalog product'+(count===1?'':'s'):'None';
 $('completeMessage').textContent=(info.organizationName||values().organizationName)+
  ' has been created. The customer owner invitation is recorded and queued for delivery; it has not been confirmed sent.';
 $('completeDirectory').href='/admin/customers?organization='+encodeURIComponent(info.id);
 $('completeProject').href='/projects?organizationId='+encodeURIComponent(info.id);
 document.querySelector('.wizard-card').scrollIntoView({block:'start'});
}
async function recoverOriginal(){
 const info=await request('/api/admin-management/onboardings/requests/'+encodeURIComponent(state.requestKey));
 if(!info.found)return false;
 showComplete({...info,productCount:custom()?0:selected().length});
 return true;
}
function showRecovery(message){
 form.hidden=true;$('completeScreen').hidden=true;$('recoveryScreen').hidden=false;
 $('recoveryMessage').textContent=message;
 $('checkOriginalRequest').focus();
}
async function submit(){
 if(state.busy)return;
 const error=errorForStep(3);
 if(error){showError(error);return;}
 state.busy=true;state.attempted=true;render();
 const payload={...values(),products:custom()?[]:selected()};
 try{
  const result=await request('/api/admin-management/onboardings',{
   method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':state.requestKey},
   body:JSON.stringify(payload)
  });
  showComplete({id:result.id,slug:payload.slug,organizationName:result.organizationName,
    productCount:result.products?.length??payload.products.length});
 }catch(error){
  try{
   if(await recoverOriginal())return;
  }catch{
   // An unresolved request must never get a second idempotency key.
  }
  if(error.status===409){
   state.busy=false;state.attempted=false;
   state.requestKey=crypto.randomUUID();
   form.hidden=false;go(0,true);
   showError('This organization or workspace identifier conflicts with an existing record. Review and choose a unique identifier.');
   return;
  }
  showRecovery(error.message+' Check the original request before creating another organization.');
 }finally{
  state.busy=false;
  next.disabled=false;
 }
}
async function advance(){
 if(state.busy)return;
 const error=errorForStep();
 if(error){showError(error);return;}
 if(state.step===3){await submit();return;}
 if(state.step===0){
  state.busy=true;next.disabled=true;
  const allowed=await checkSlug();
  state.busy=false;
  if(!allowed){next.disabled=false;showError('Use an available workspace identifier before continuing.');return;}
 }
 go(state.step+1,true);
}
next.onclick=()=>void advance();
previous.onclick=()=>go(state.step-1,true);
form.addEventListener('submit',e=>{e.preventDefault();void advance();});
$('orgName').addEventListener('input',()=>{
 if(!state.slugEdited){
  $('orgSlug').value=slugify($('orgName').value);
  state.slugChecked='';state.slugAvailable=null;slugStatus();
 }
});
$('orgSlug').addEventListener('input',()=>{
 state.slugEdited=true;state.slugChecked='';state.slugAvailable=null;slugStatus();showError();
});
$('orgSlug').addEventListener('blur',()=>{if($('orgSlug').checkValidity())void checkSlug();});
$('customOnly').addEventListener('change',()=>{$('catalogConfiguration').hidden=true;showError();});
$('catalogMode').addEventListener('change',()=>{
 $('catalogConfiguration').hidden=false;showError();
 void loadCatalog();
});
$('catalogRetry').onclick=()=>{
 state.catalogLoaded=false;state.catalogError='';void loadCatalog();
};
$('confirm').addEventListener('change',()=>showError());
$('checkOriginalRequest').onclick=async()=>{
 $('recoveryMessage').textContent='Checking the original request…';
 try{
  if(!await recoverOriginal())$('recoveryMessage').textContent='No committed request is visible yet. You may retry using the same request identifier or return to the review.';
 }catch(e){$('recoveryMessage').textContent=e.message;}
};
$('retryOriginalRequest').onclick=()=>{
 $('recoveryScreen').hidden=true;form.hidden=false;
 go(3);$('confirm').checked=true;void submit();
};
$('returnToReview').onclick=()=>{
 $('recoveryScreen').hidden=true;form.hidden=false;go(3,true);
};
$('startAgain').onclick=()=>{
 form.reset();form.hidden=false;$('completeScreen').hidden=true;$('recoveryScreen').hidden=true;
 state.step=0;state.busy=false;state.slugEdited=false;state.slugChecked='';
 state.slugAvailable=null;state.chosen.clear();state.plans.clear();state.requestKey=crypto.randomUUID();
 state.attempted=false;state.created=null;slugStatus();
 render();$('orgName').focus();
};
render();
})();
