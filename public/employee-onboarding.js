(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const form=$('employeeOnboardForm');
 const panels=[...document.querySelectorAll('[data-staff-panel]')];
 const steps=[...document.querySelectorAll('[data-staff-step]')];
 let step=0,busy=false,pending=null;
 const error=message=>{$('onboardError').textContent=message||'';$('onboardError').hidden=!message;};
 function values(){
  return {fullName:form.elements.fullName.value.trim(),email:form.elements.email.value.trim().toLowerCase(),
   department:form.elements.department.value.trim(),jobTitle:form.elements.jobTitle.value.trim(),
   employmentType:form.elements.employmentType.value,startDate:form.elements.startDate.value};
 }
 function validPage(index){
  const fields=[...panels[index].querySelectorAll('input,select')];
  for(const field of fields){
   if(!field.checkValidity()){field.reportValidity();field.focus();return false;}
  }
  return true;
 }
 function drawReview(){
  const item=values();
  const names={fullName:'Name',email:'Email',department:'Department',jobTitle:'Title',
   employmentType:'Employment type',startDate:'Start date'};
  const type={full_time:'Full-time',part_time:'Part-time',intern:'Intern',contract:'Contract'};
  const dl=$('employeeReview');dl.replaceChildren();
  for(const key of Object.keys(names)){
   const row=document.createElement('div'),term=document.createElement('dt'),desc=document.createElement('dd');
   term.textContent=names[key];desc.textContent=key==='employmentType'?type[item[key]]:item[key];
   row.append(term,desc);dl.append(row);
  }
 }
 function showStep(next){
  step=next;error('');
  for(let i=0;i<panels.length;i++){panels[i].hidden=i!==step;steps[i].classList.toggle('current',i===step);steps[i].classList.toggle('done',i<step);}
  $('staffStep').textContent='STEP '+(step+1)+' OF 3';
  const progress=[33,67,100][step];$('staffProgress').textContent=progress+'% COMPLETE';$('staffProgressFill').style.width=progress+'%';
  $('staffPrevious').disabled=step===0;
  $('staffNext').textContent=step===2?'Save employee':'Continue';
  if(step===2){drawReview();$('employeeConfirmed').checked=false;}
 }
 async function submit(){
  if(busy||!validPage(2))return;
  const payload=values(),signature=JSON.stringify(payload);
  if(pending?.signature!==signature)pending={signature,key:crypto.randomUUID()};
  busy=true;$('staffNext').disabled=true;$('staffPrevious').disabled=true;
  error('');
  try{
   const response=await fetch('/api/employees',{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Idempotency-Key':pending.key},body:JSON.stringify(payload)
   });
   if(response.status===401){location.assign('/login');return;}
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.code==='SCHEMA_NOT_READY'?'The reviewed employee migration must be installed before saving records.':result.message||'Employee onboarding could not be saved.');
   pending=null;
   $('employeeOnboardForm').hidden=true;$('onboardComplete').hidden=false;
   $('onboardCompleteMessage').textContent='Employee '+payload.fullName+' ('+payload.email+') was saved as Onboarding. No account or invitation was created.';
  }catch(failure){error(failure.message);}
  finally{busy=false;$('staffNext').disabled=false;$('staffPrevious').disabled=step===0;}
 }
 $('staffPrevious').addEventListener('click',()=>{if(!busy&&step>0)showStep(step-1);});
 $('staffNext').addEventListener('click',()=>{
  if(busy)return;
  if(step===2){submit();return;}
  if(!validPage(step))return;
  showStep(step+1);
 });
 // No accidental GET submission or password/capability in URLs.
 form.addEventListener('submit',event=>{event.preventDefault();if(step===2)submit();else $('staffNext').click();});
 form.addEventListener('input',()=>{if(!busy)error('');});
 $('onboardAnother').addEventListener('click',()=>{
  form.reset();pending=null;$('onboardComplete').hidden=true;form.hidden=false;showStep(0);
 });
 showStep(0);
})();
