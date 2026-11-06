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
  $('staffNext').textContent=step===2?submitTitle():'Continue';
  if(step===2){drawReview();$('employeeConfirmed').checked=false;}
 }
 function selectedMethod(){return form.elements.accessMethod.value;}
 function submitTitle(){
  return {invite:'Save and create invitation',email:'Save and email invitation',temporary:'Save and issue credentials',roster:'Save employee record'}[selectedMethod()]||'Save employee';
 }
 function showHandoff(title,note,value){
  $('employeeHandoffTitle').textContent=title;$('employeeHandoffNote').textContent=note;
  $('employeeHandoffValue').value=value;$('employeeHandoffPanel').hidden=false;
 }
 async function submit(){
  if(busy||!validPage(2))return;
  const payload=values(),method=selectedMethod(),signature=JSON.stringify(payload);
  if(pending?.signature!==signature)pending={signature,key:crypto.randomUUID()};
  busy=true;$('staffNext').disabled=true;$('staffPrevious').disabled=true;error('');
  try{
   const response=await fetch('/api/employees',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Idempotency-Key':pending.key},body:JSON.stringify(payload)});
   if(response.status===401){location.assign('/login');return;}
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.code==='SCHEMA_NOT_READY'?'The reviewed employee migration must be installed before saving records.':result.message||'Employee onboarding could not be saved.');
   $('setupEmployeeLogin').href='/employees/'+result.id+'/account-link';
   pending=null;form.hidden=true;$('onboardComplete').hidden=false;$('employeeHandoffPanel').hidden=true;
   $('employeeHandoffValue').value='';
   $('onboardCompleteMessage').textContent='Employee '+payload.fullName+' ('+payload.email+') was saved as Onboarding.';
   if(method==='roster'){
    $('onboardDeliveryStatus').textContent='Roster saved without a login. Use Set up employee login to invite this employee later.';
    return;
   }
   $('onboardDeliveryStatus').textContent='Creating the employee login handoff…';
   try{
    const temporary=method==='temporary';
    const endpoint=temporary?'/api/employee-credentials/employees/':'/api/employee-enrollment/employees/';
    const fields={rosterVersion:result.version,confirmed:true,...(method==='email'?{delivery:'email'}:{})};
    const issuedResponse=await fetch(endpoint+result.id,{method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(fields)});
    const issued=await issuedResponse.json().catch(()=>({}));
    if(!issuedResponse.ok)throw Error(issued.message||'Account setup could not be completed.');
    if(issued.replayed){
     $('onboardDeliveryStatus').textContent='This employee setup was already created. Open Set up employee login to review or explicitly reissue its private link.';
     return;
    }
    if(temporary&&issued.temporaryPassword){
     const details='Sign in: '+issued.loginUrl+'\nWork email: '+issued.email+'\nTemporary password: '+issued.temporaryPassword+'\nExpires: '+new Date(issued.expiresAt).toLocaleString()+'\nReplace this password on first sign-in.';
     showHandoff('Generated temporary credentials','Only share with the named employee through a trusted private channel. The temporary password is shown once.',details);
     $('onboardDeliveryStatus').textContent='Temporary credentials created. The employee must replace their password before receiving a portal session.';
    }else if(!temporary&&issued.url){
     showHandoff('Private employee setup link','Shown once. Copy and deliver privately to the named employee. Refreshing this page removes the link.',issued.url);
     $('onboardDeliveryStatus').textContent=issued.emailDelivery?.message||
      'Invitation created. No email was sent; share this private link with the employee.';
    }else{
     $('onboardDeliveryStatus').textContent='The account setup requires review. Open Set up employee login to inspect its current state.';
    }
   }catch(setupError){
    $('onboardDeliveryStatus').textContent='The employee record was saved, but login setup did not complete: '+setupError.message+
     ' Use Set up employee login to inspect or recover. Do not create a duplicate employee.';
   }
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
 form.addEventListener('change',()=>{if(!busy&&step===2)$('staffNext').textContent=submitTitle();});
 // Prevent selecting provider delivery before server-side configuration is known.
 async function checkEmailAvailability(){
  const option=$('employeeEmailOption'),hint=$('employeeEmailHint');
  try{
   const response=await fetch('/api/employee-enrollment/delivery',{credentials:'same-origin',cache:'no-store'});
   const data=await response.json().catch(()=>({}));
   option.disabled=!(response.ok&&data.emailConfigured===true);
   hint.textContent=option.disabled?
    'Email delivery is not configured. Use the private invitation link and configure an approved sender to email a reissued invitation later.':
    'Submit this invitation to the configured email provider. A backup link will also be shown; inbox delivery is not guaranteed.';
  }catch{
   option.disabled=true;hint.textContent='Email delivery readiness could not be verified. Use the private invitation link.';
  }
 }
 checkEmailAvailability();
 $('copyEmployeeHandoff').addEventListener('click',async()=>{
  const field=$('employeeHandoffValue');
  try{await navigator.clipboard.writeText(field.value);$('onboardDeliveryStatus').textContent='Private handoff copied. Deliver it only to the named employee.';}
  catch{field.focus();field.select();$('onboardDeliveryStatus').textContent='Select and copy the private handoff details.';}
 });
 $('onboardAnother').addEventListener('click',()=>{
  form.reset();pending=null;$('employeeHandoffValue').value='';$('employeeHandoffPanel').hidden=true;
  $('onboardDeliveryStatus').textContent='';$('onboardComplete').hidden=true;form.hidden=false;showStep(0);
 });
 showStep(0);
})();
