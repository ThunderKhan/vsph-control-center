(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const form=$('employeeOnboardForm');
 const panels=[...document.querySelectorAll('[data-staff-panel]')];
 const steps=[...document.querySelectorAll('[data-staff-step]')];
 const legends=panels.map(panel=>panel.querySelector('legend'));
 let step=0,busy=false,pending=null;
 const error=(message,existingId)=>{
  $('onboardError').textContent=message||'';$('onboardError').hidden=!message;
  const link=$('existingEmployeeLink');
  link.hidden=!existingId;
  if(existingId)link.href='/employees/'+encodeURIComponent(existingId)+'/account-link';
 };
 function values(){
  return {fullName:form.elements.fullName.value.trim(),email:form.elements.email.value.trim().toLowerCase(),
   department:form.elements.department.value.trim(),jobTitle:form.elements.jobTitle.value.trim(),
   employmentType:form.elements.employmentType.value,startDate:form.elements.startDate.value};
 }
 function validPage(index){
  const fields=[...panels[index].querySelectorAll('input,select')];
  for(const field of fields){
   if(!field.checkValidity()){field.setAttribute('aria-invalid','true');field.reportValidity();field.focus();return false;}
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
 function showStep(next,focusHeading=false){
  step=next;error('');
  for(let i=0;i<panels.length;i++){
   panels[i].hidden=i!==step;
   steps[i].classList.toggle('current',i===step);
   steps[i].classList.toggle('done',i<step);
   if(i===step)steps[i].setAttribute('aria-current','step');
   else steps[i].removeAttribute('aria-current');
  }
  $('staffStep').textContent='STEP '+(step+1)+' OF 3';
  const progress=[33,67,100][step];
  $('staffProgress').textContent=progress+'% COMPLETE';
  $('staffProgressFill').style.width=progress+'%';
  $('staffProgressBar').setAttribute('aria-valuenow',String(progress));
  document.querySelector('.people-wizard-panel').setAttribute('aria-labelledby',legends[step].id);
  $('staffPrevious').disabled=step===0;
  $('staffNext').textContent=step===2?'Create employee':'Continue';
  if(step===2){drawReview();$('employeeConfirmed').checked=false;}
  if(focusHeading)legends[step].focus();
 }

 function showHandoff(title,note,value){
  $('employeeHandoffTitle').textContent=title;$('employeeHandoffNote').textContent=note;
  $('employeeHandoffValue').value=value;$('employeeHandoffPanel').hidden=false;
 }
 async function submit(){
  if(busy||!validPage(2))return;
  const payload=values(),signature=JSON.stringify(payload);
  if(pending?.signature!==signature)pending={signature,key:crypto.randomUUID()};
  busy=true;$('staffNext').disabled=true;$('staffNext').textContent='Creating…';
  $('staffNext').setAttribute('aria-busy','true');$('staffPrevious').disabled=true;error('');
  try{
   const response=await fetch('/api/employees',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Idempotency-Key':pending.key},body:JSON.stringify(payload)});
   if(response.status===401){location.assign('/login');return;}
   const result=await response.json().catch(()=>({}));
   if(!response.ok){
    if(result.code==='EMPLOYEE_EXISTS'&&result.employeeId){
     error(result.message||'This work email already belongs to an employee.',result.employeeId);
     return;
    }
    throw Error(result.code==='SCHEMA_NOT_READY'?'The reviewed employee migration must be installed before saving records.':result.message||'Employee onboarding could not be saved.');
   }
   $('setupEmployeeLogin').href='/employees/'+result.id+'/account-link';
   pending=null;form.hidden=true;$('onboardComplete').hidden=false;$('employeeHandoffPanel').hidden=true;
   $('onboardComplete').focus();
   $('employeeHandoffValue').value='';
   $('onboardCompleteMessage').textContent='Employee '+payload.fullName+' ('+payload.email+') was saved as Onboarding.';
   $('onboardDeliveryStatus').textContent='Generating the private setup link…';
   try{
    const issuedResponse=await fetch('/api/employee-enrollment/employees/'+result.id,{
     method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},
     body:JSON.stringify({rosterVersion:result.version,confirmed:true})
    });
    const issued=await issuedResponse.json().catch(()=>({}));
    if(!issuedResponse.ok)throw Error(issued.message||'Account setup could not be completed.');
    if(issued.replayed){
     $('onboardDeliveryStatus').textContent='An invitation was already created. Open Set up employee login to review or explicitly reissue a private link.';
     return;
    }
    if(issued.url){
     showHandoff('Private employee setup link','Shown once. Share privately with the named employee. Refreshing this page removes the link.',issued.url);
     $('onboardDeliveryStatus').textContent='Invitation created. Copy the private link and deliver it to the employee; no email was sent.';
    }else{
     $('onboardDeliveryStatus').textContent='Account setup needs review. Open Set up employee login to inspect its current state.';
    }
   }catch(setupError){
    $('onboardDeliveryStatus').textContent='The employee record was saved, but login setup did not complete: '+setupError.message+
     ' Use Set up employee login to inspect or recover. Do not create a duplicate employee.';
   }
  }catch(failure){error(failure.message);}
  finally{
   busy=false;$('staffNext').disabled=false;$('staffNext').textContent='Create employee';
   $('staffNext').removeAttribute('aria-busy');$('staffPrevious').disabled=step===0;
  }
 }
 $('staffPrevious').addEventListener('click',()=>{if(!busy&&step>0)showStep(step-1,true);});
 $('staffNext').addEventListener('click',()=>{
  if(busy)return;
  if(step===2){submit();return;}
  if(!validPage(step))return;
  showStep(step+1,true);
 });
 // No accidental GET submission or password/capability in URLs.
 form.addEventListener('submit',event=>{event.preventDefault();if(step===2)submit();else $('staffNext').click();});
 const clearInputFeedback=event=>{
  if(event.target?.checkValidity?.())event.target.removeAttribute('aria-invalid');
  if(!busy)error('');
 };
 form.addEventListener('input',clearInputFeedback);
 form.addEventListener('change',clearInputFeedback);
 $('copyEmployeeHandoff').addEventListener('click',async()=>{
  const field=$('employeeHandoffValue');
  try{await navigator.clipboard.writeText(field.value);$('onboardDeliveryStatus').textContent='Private handoff copied. Deliver it only to the named employee.';}
  catch{field.focus();field.select();$('onboardDeliveryStatus').textContent='Select and copy the private handoff details.';}
 });
 $('onboardAnother').addEventListener('click',()=>{
  form.reset();pending=null;$('employeeHandoffValue').value='';$('employeeHandoffPanel').hidden=true;
  $('onboardDeliveryStatus').textContent='';$('onboardComplete').hidden=true;form.hidden=false;
  for(const field of form.querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid');
  showStep(0,true);
 });
 showStep(0);
})();
