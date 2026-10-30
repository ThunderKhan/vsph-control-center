(()=>{
'use strict';
const steps=[...document.querySelectorAll('.wizard-step')];
const list=[...document.querySelectorAll('.step-list .step')];
const byId=id=>document.getElementById(id);
const form=byId('onboardingForm'),next=byId('nextButton'),previous=byId('previousButton');
const errors=byId('wizardError');
let submissionKey=crypto.randomUUID();
const state={step:0,applications:[],chosen:new Set(),plans:new Map(),busy:false,slugEdited:false};
const slugify=value=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160);
function setError(message=''){errors.textContent=message;errors.hidden=!message}
function node(tag,className,text){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=String(text);
 return el;
}
function titleFor(id){return state.applications.find(app=>app.id===id)?.name||'Product'}
function tomorrowDay(days=14){
 const date=new Date();date.setDate(date.getDate()+days);
 const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
 return year+'-'+month+'-'+day;
}
function values(){
 return {organizationName:byId('orgName').value.trim(),slug:byId('orgSlug').value.trim().toLowerCase(),
 adminName:byId('adminName').value.trim(),adminEmail:byId('adminEmail').value.trim().toLowerCase()};
}
function selected(){
 return [...state.chosen].map(id=>({applicationId:id,...(state.plans.get(id)||{planCode:'standard',status:'trial',endsAt:tomorrowDay()})}));
}
function checkedStep(){
 const data=values();
 if(state.step===0){
  if(!data.organizationName||data.organizationName.length>150)return 'Enter the customer organization name.';
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)||data.slug.length>160)return 'Enter a unique slug using lowercase letters, numbers and hyphens.';
 }
 if(state.step===1){
  if(!data.adminName)return 'Enter the administrator’s full name.';
  if(!byId('adminEmail').validity.valid||!data.adminEmail)return 'Enter a valid work email address.';
 }
 if(state.step===2 && state.chosen.size===0)return 'Select at least one product.';
 if(state.step===3){
  for(const p of selected()){
   if(!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(p.planCode))return 'Enter a valid plan code for '+titleFor(p.applicationId)+'.';
   if(p.status==='trial'&&!p.endsAt)return 'Choose an end date for the '+titleFor(p.applicationId)+' trial.';
   if(p.endsAt){
     const end=new Date(p.endsAt+'T23:59:59.999Z');
     if(!Number.isFinite(end.getTime())||end.getTime()<=Date.now())return 'Choose a future subscription end date for '+titleFor(p.applicationId)+'.';
   }
  }
 }
 if(state.step===4&&!byId('confirm').checked)return 'Confirm the onboarding details before submitting.';
 return '';
}
function productChoices(){
 const box=byId('productChoices');box.replaceChildren();
 if(!state.applications.length){
  box.append(node('p','subtle','No active products available. Create an application in Platform Administration first.'));
  return;
 }
 for(const app of state.applications){
  const label=node('label','product-choice');
  const check=document.createElement('input');check.type='checkbox';check.value=app.id;check.checked=state.chosen.has(app.id);
  check.setAttribute('aria-label','Enable '+app.name);
  const info=node('span');info.append(node('strong','',app.name),node('small','',app.code));
  label.append(check,info);
  check.addEventListener('change',()=>{
   if(check.checked)state.chosen.add(app.id);else state.chosen.delete(app.id);
   next.disabled=!state.chosen.size;
   setError();
  });
  box.append(label);
 }
}
function subscriptionCards(){
 const container=byId('subscriptionCards');container.replaceChildren();
 for(const app of state.applications.filter(app=>state.chosen.has(app.id))){
  const current=state.plans.get(app.id)||{planCode:'standard',status:'trial',endsAt:tomorrowDay()};
  const card=node('article','subscription-card');card.append(node('h3','',app.name));
  const fields=node('div','subscription-fields');
  function field(labelText,control){
    const wrapper=node('div','subscription-field');const label=node('label','',labelText);
    label.htmlFor=control.id;wrapper.append(label,control);fields.append(wrapper);
  }
  const plan=document.createElement('input');plan.id='plan-'+app.id;plan.value=current.planCode;plan.maxLength=60;plan.required=true;
  plan.addEventListener('input',()=>{store();setError()});
  field('Plan code',plan);
  const status=document.createElement('select');status.id='status-'+app.id;
  for(const v of ['trial','active']){const option=node('option','',v==='trial'?'Trial':'Active');option.value=v;status.append(option)}
  status.value=current.status;
  status.addEventListener('change',()=>{if(status.value==='trial'&&!end.value)end.value=tomorrowDay();store();setError()});
  field('Subscription status',status);
  const end=document.createElement('input');end.id='end-'+app.id;end.type='date';end.min=tomorrowDay(1);end.value=current.endsAt;
  end.addEventListener('change',()=>{store();setError()});
  field('End date (trial required)',end);
  function store(){state.plans.set(app.id,{planCode:plan.value.trim().toLowerCase(),status:status.value,endsAt:end.value})}
  card.append(fields);container.append(card);
  store();
 }
}
function review(){
 const box=byId('reviewDetails');box.replaceChildren();
 const info=values();
 function item(label,lines){
  const card=node('div','review-item');card.append(node('strong','',label));
  for(const line of lines)card.append(node('p','',line));
  box.append(card);
 }
 item('Organization',[info.organizationName, 'Workspace slug: '+info.slug]);
 item('Administrator invitation',[info.adminName,info.adminEmail,'Status: invitation pending acceptance']);
 item('Products and plans',selected().map(p=>titleFor(p.applicationId)+' — '+p.planCode+' / '+p.status+(p.endsAt?' / through '+p.endsAt:'')));
}
function render(){
 setError();
 steps.forEach((panel,i)=>panel.hidden=i!==state.step);
 list.forEach((item,i)=>{item.classList.toggle('active',i===state.step);item.classList.toggle('done',i<state.step);if(i===state.step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current')});
 byId('stepIndicator').textContent='STEP '+(state.step+1)+' OF 5';
 byId('progressPercent').textContent=((state.step+1)*20)+'% COMPLETE';
 byId('progressFill').style.width=((state.step+1)*20)+'%';
 previous.disabled=state.step===0||state.busy;
 next.textContent=state.step===4?'Queue customer setup':'Continue';
 next.disabled=state.busy||(state.step===2&&!state.chosen.size)||(state.step===4&&!byId('confirm').checked);
 if(state.step===2)productChoices();
 if(state.step===3)subscriptionCards();
 if(state.step===4)review();
}
async function request(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 if(response.status===401){window.location.replace('/login');throw Error('Sign in again.')}
 if(response.status===403){window.location.replace('/dashboard');throw Error('Platform administrator access required.')}
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.message||'Request failed. Please retry.');
 return body;
}
async function submit(){
 if(state.busy)return;
 const message=checkedStep();if(message)return setError(message);
 const data=values();state.busy=true;render();next.textContent='Creating customer…';next.disabled=true;previous.disabled=true;
 try{
  const payload={...data,products:selected().map(p=>({
    applicationId:p.applicationId,planCode:p.planCode,status:p.status,
    endsAt:p.endsAt?p.endsAt+'T23:59:59.999Z':null
  }))};
  const result=await request('/api/admin-management/onboardings',{
   method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':submissionKey},body:JSON.stringify(payload)
  });
  form.hidden=true;byId('completeScreen').hidden=false;
  byId('completeMessage').textContent=result.organizationName+' was queued with '+result.products.length+
    ' product'+(result.products.length===1?'':'s')+'. Invitation delivery is queued. Check Provisioning recovery for status.';
  document.querySelector('.wizard-card').scrollIntoView({behavior:'auto',block:'start'});
 }catch(e){state.busy=false;render();setError(e.message)}
}
next.addEventListener('click',()=>{
 const message=checkedStep();if(message)return setError(message);
 if(state.step===4)return void submit();
 state.step++;render();
});
previous.addEventListener('click',()=>{if(state.busy||state.step===0)return;state.step--;render()});
byId('confirm').addEventListener('change',()=>{next.disabled=!byId('confirm').checked});
byId('orgName').addEventListener('input',e=>{
 if(!state.slugEdited)byId('orgSlug').value=slugify(e.target.value);
});
byId('orgSlug').addEventListener('input',()=>{state.slugEdited=true});
form.addEventListener('submit',e=>{e.preventDefault();next.click()});
byId('startAgain').addEventListener('click',()=>{
 submissionKey=crypto.randomUUID();form.reset();form.hidden=false;byId('completeScreen').hidden=true;
 state.step=0;state.busy=false;state.chosen.clear();state.plans.clear();state.slugEdited=false;render();
});
(async()=>{
 try{
  const lookups=await request('/api/admin-management/lookups');
  state.applications=Array.isArray(lookups.applications)?lookups.applications.filter(a=>a.status==='active'):[];
  render();
 }catch(e){setError(e.message);next.disabled=true}
})();
})();