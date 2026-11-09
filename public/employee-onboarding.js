(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const form=$('employeeOnboardForm');
 const panels=[...document.querySelectorAll('[data-staff-panel]')];
 const steps=[...document.querySelectorAll('[data-staff-step]')];
 const legends=panels.map(panel=>panel.querySelector('legend'));
 const fieldNames=['fullName','email','department','jobTitle','employmentType','startDate'];
 const reviewGroups=[
  {element:$('employeeReviewIdentity'),fields:[['fullName','Full name'],['email','Work email']]},
  {element:$('employeeReviewPosition'),fields:[['department','Department'],['jobTitle','Job title'],['employmentType','Employment type'],['startDate','Start date']]}
 ];
 const employmentTypes={full_time:'Full-time',part_time:'Part-time',intern:'Intern',contract:'Contract'};
 let step=0,editing=null,busy=false,pending=null;
 let linkAvailable=false,linkCopied=false,copyFeedbackTimer=null,uncertainEmail=null;

 const error=(message,existingId,archived=false)=>{
  $('onboardError').textContent=message||'';
  $('onboardError').hidden=!message;
  $('existingEmployeeLink').hidden=!existingId;
  if(existingId){
    $('existingEmployeeLink').href=archived
      ? '/employees?restore='+encodeURIComponent(existingId)
      : '/employees/'+encodeURIComponent(existingId)+'/account-link';
    $('existingEmployeeLink').textContent=archived?'Review archived employee':'Review existing employee';
  }
 };
 function values(){
  return {fullName:form.elements.fullName.value.trim(),email:form.elements.email.value.trim().toLowerCase(),
   department:form.elements.department.value.trim(),jobTitle:form.elements.jobTitle.value.trim(),
   employmentType:form.elements.employmentType.value,startDate:form.elements.startDate.value};
 }
 function sectionSnapshot(index){
  const keys=index===0?fieldNames.slice(0,2):fieldNames.slice(2);
  return Object.fromEntries(keys.map(key=>[key,form.elements[key].value]));
 }
 function restoreSnapshot(snapshot){
  for(const [key,value] of Object.entries(snapshot))form.elements[key].value=value;
 }
 function validPage(index){
  for(const field of panels[index].querySelectorAll('input,select')){
   if(!field.checkValidity()){
    field.setAttribute('aria-invalid','true');
    field.reportValidity();field.focus();
    return false;
   }
  }
  return true;
 }
 function drawReview(){
  const data=values();
  for(const group of reviewGroups){
   group.element.replaceChildren();
   for(const [key,title] of group.fields){
    const row=document.createElement('div');
    const dt=document.createElement('dt');
    const dd=document.createElement('dd');
    dt.textContent=title;
    dd.textContent=key==='employmentType'?(employmentTypes[data[key]]||data[key]):data[key];
    row.append(dt,dd);group.element.append(row);
   }
  }
 }
 function showStep(next,focusHeading=false,resetConfirmation=true){
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
  $('staffPrevious').disabled=step===0&&!editing;
  $('staffPrevious').textContent=editing?'Discard changes':'Previous';
  $('staffNext').textContent=editing?'Apply changes':step===2?'Create employee':'Continue';
  if(step===2){
   drawReview();
   if(resetConfirmation)$('employeeConfirmed').checked=false;
  }
  if(focusHeading)legends[step].focus();
 }
 function enterEdit(index){
  if(busy||step!==2)return;
  editing={index,snapshot:sectionSnapshot(index),confirmed:$('employeeConfirmed').checked};
  showStep(index,true);
 }
 function finishEdit(apply){
  if(!editing||busy)return;
  const previous=editing;
  if(apply&&!validPage(previous.index))return;
  const changed=JSON.stringify(sectionSnapshot(previous.index))!==JSON.stringify(previous.snapshot);
  if(!apply)restoreSnapshot(previous.snapshot);
  editing=null;
  showStep(2,false,apply&&changed);
  if(!(apply&&changed))$('employeeConfirmed').checked=previous.confirmed;
  $('employeeReview').querySelector('[data-edit-step="'+previous.index+'"]').focus();
 }
 function accessUrl(id){
  return '/employees/'+encodeURIComponent(id)+'/account-link';
 }
 function clearInvitation(){
  linkAvailable=false;linkCopied=false;
  if(copyFeedbackTimer!==null){clearTimeout(copyFeedbackTimer);copyFeedbackTimer=null;}
  $('employeeHandoffValue').value='';
  $('copyEmployeeHandoffLabel').textContent='Copy invitation link';
 }
 function needsLeaveWarning(){return linkAvailable&&!linkCopied;}
 // Navigation needs an application-styled decision. Browser unload warnings remain
 // native by platform design for tab close and reload, where custom UI is impossible.
 document.addEventListener('click',async event=>{
  const anchor=event.target.closest?.('a[href]');
  if(!anchor||!linkAvailable||event.defaultPrevented||!needsLeaveWarning())return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!await VSPHUI.confirm('This private invitation link has not been copied. Leaving will hide its only displayed copy.',{title:'Leave without copying?',confirmLabel:'Leave page',danger:true}))return;
  const href=anchor.href;clearInvitation();location.assign(href);
 },true);
 window.addEventListener('beforeunload',event=>{
  if(!needsLeaveWarning())return;
  event.preventDefault();
  event.returnValue='';
 });
 window.addEventListener('pagehide',clearInvitation);

 function showCompletion(title,description){
  $('onboardingWizard').hidden=true;
  $('onboardComplete').hidden=false;
  $('completeTitle').textContent=title;
  $('completeDescription').textContent=description;
  $('onboardComplete').focus();
 }
 function showEmployee(data,id,status){
  $('createdEmployeeSummary').hidden=false;
  $('createdEmployeeName').textContent=data.fullName;
  $('createdEmployeeInitials').textContent=data.fullName.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
  $('createdEmployeeEmail').textContent=data.email;
  $('createdEmployeePosition').textContent=data.department+' · '+data.jobTitle;
  const label=typeof status==='string'&&status.trim()?status.replaceAll('_',' '):'';
  $('createdEmployeeStatus').hidden=!label;
  $('createdEmployeeStatus').textContent=label;
  $('setupEmployeeLogin').hidden=!id;
  if(id)$('setupEmployeeLogin').href=accessUrl(id);
 }
 function showRecovery(message,allowCheck=false){
  $('employeeHandoffPanel').hidden=true;
  $('onboardRecovery').hidden=false;
  $('onboardRecoveryMessage').textContent=message;
  $('checkEmployeeStatus').hidden=!allowCheck;
  $('onboardAnother').hidden=allowCheck;
  $('onboardDeliveryStatus').textContent='';
 }
 function partialSuccess(data,id,status,message){
  clearInvitation();
  showCompletion('Employee saved','Account setup needs attention.');
  showEmployee(data,id,status);
  showRecovery(message||'The employee record was saved, but the invitation could not be confirmed. Manage access to review the setup. Do not create another employee.');
 }
 function unknownResult(data){
  clearInvitation();
  uncertainEmail=data.email;
  $('createdEmployeeSummary').hidden=true;
  $('setupEmployeeLogin').hidden=true;
  showCompletion('Creation status unknown','We could not confirm whether the employee was saved.');
  showRecovery('Check the employee directory before trying to create this employee again. A connection error does not mean the request failed.',true);
 }
 async function checkExisting(email){
  const response=await fetch('/api/employees?search='+encodeURIComponent(email.slice(0,80)),{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){location.assign('/login');return null;}
  if(!response.ok)throw Error('Employee status is temporarily unavailable.');
  const result=await response.json();
  return result.employees?.find(employee=>employee.email===email)||null;
 }
 async function reconcileUnknown(data){
  try{
   const found=await checkExisting(data.email);
   if(found?.id){
    partialSuccess(data,found.id,found.status,'An employee with this work email exists. Open Manage access to inspect the record and its invitation state. Do not create another employee.');
    return;
   }
  }catch{/* Unconfirmed outcomes must stay unconfirmed. */}
  unknownResult(data);
 }
 function showHandoff(issued){
  clearInvitation();
  $('onboardRecovery').hidden=true;
  $('employeeHandoffValue').value=issued.url;
  $('employeeHandoffPanel').hidden=false;
  linkAvailable=true;
  const expiration=issued.expiresAt||issued.expires_at;
  const timestamp=expiration?new Date(expiration):null;
  const valid=timestamp&&!Number.isNaN(timestamp.getTime());
  $('employeeInviteExpiry').hidden=!valid;
  if(valid)$('employeeInviteExpiry').textContent='Expires '+timestamp.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  $('completeTitle').textContent='Employee created';
  $('completeDescription').textContent='Share the private setup link to continue onboarding.';
  $('onboardDeliveryStatus').textContent='';
 }
 async function issueInvitation(data,created){
  $('onboardDeliveryStatus').textContent='Generating the private setup link…';
  try{
   const issuedResponse=await fetch('/api/employee-enrollment/employees/'+created.id,{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},
    body:JSON.stringify({rosterVersion:created.version,confirmed:true})
   });
   if(issuedResponse.status===401){location.assign('/login');return;}
   const issued=await issuedResponse.json().catch(()=>({}));
   if(!issuedResponse.ok)throw Error('Invitation generation could not be confirmed.');
   if(issued.replayed||typeof issued.url!=='string'||!issued.url){
    partialSuccess(data,created.id,created.status,'The employee record exists, but no new private setup link can be displayed. Open Manage access to inspect the invitation and explicitly recover it if needed.');
    return;
   }
   const expiry=issued.expiresAt||issued.expires_at;
   if(expiry&&Number.isFinite(Date.parse(expiry))&&Date.parse(expiry)<=Date.now()){
    partialSuccess(data,created.id,created.status,'The invitation has already expired. Open Manage access to inspect or reissue a private link.');
    return;
   }
   showHandoff(issued);
  }catch{
   partialSuccess(data,created.id,created.status,'The employee record was saved, but the invitation could not be confirmed. Open Manage access to review or recover setup. Do not create another employee.');
  }
 }
 async function submit(){
  if(busy||!validPage(2))return;
  const data=values(),signature=JSON.stringify(data);
  if(pending?.signature!==signature)pending={signature,key:crypto.randomUUID()};
  busy=true;
  $('staffNext').disabled=true;$('staffPrevious').disabled=true;
  $('staffNext').textContent='Creating…';$('staffNext').setAttribute('aria-busy','true');error('');
  try{
   let response;
   try{
    response=await fetch('/api/employees',{
     method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json','Idempotency-Key':pending.key},body:JSON.stringify(data)
    });
   }catch{
    await reconcileUnknown(data);return;
   }
   if(response.status===401){location.assign('/login');return;}
   const result=await response.json().catch(()=>({}));
   if(!response.ok){
    if(result.code==='EMPLOYEE_ARCHIVED'){
     error(result.message||'This employee is archived. Request owner-reviewed restoration before onboarding again.',result.employeeId,true);
     return;
    }
    if(result.code==='EMPLOYEE_EXISTS'&&result.employeeId){
     error(result.message||'This work email already belongs to an employee.',result.employeeId);return;
    }
    if(response.status>=500&&result.code!=='SCHEMA_NOT_READY'){
     await reconcileUnknown(data);return;
    }
    error(result.code==='SCHEMA_NOT_READY'?'The reviewed employee migration must be installed before saving records.':
     result.message||'Employee onboarding could not be saved. Review the details and try again.');
    return;
   }
   if(!result.id||!result.version){await reconcileUnknown(data);return;}
   pending=null;
   showCompletion('Employee saved','Generating the private setup link…');
   showEmployee(data,result.id,result.status);
   $('onboardRecovery').hidden=true;
   $('employeeHandoffPanel').hidden=true;
   await issueInvitation(data,result);
  }finally{
   busy=false;
   $('staffNext').disabled=false;$('staffPrevious').disabled=step===0&&!editing;
   $('staffNext').textContent='Create employee';$('staffNext').removeAttribute('aria-busy');
  }
 }
 $('staffPrevious').addEventListener('click',()=>{
  if(busy)return;
  if(editing){finishEdit(false);return;}
  if(step>0)showStep(step-1,true);
 });
 $('staffNext').addEventListener('click',()=>{
  if(busy)return;
  if(editing){finishEdit(true);return;}
  if(step===2){void submit();return;}
  if(!validPage(step))return;
  showStep(step+1,true);
 });
 for(const button of document.querySelectorAll('[data-edit-step]')){
  button.addEventListener('click',()=>enterEdit(Number(button.dataset.editStep)));
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(step===2&&!editing)void submit();
  else $('staffNext').click();
 });
 const clearInputFeedback=event=>{
  if(event.target?.checkValidity?.())event.target.removeAttribute('aria-invalid');
  if(!busy)error('');
 };
 form.addEventListener('input',clearInputFeedback);
 form.addEventListener('change',clearInputFeedback);
 $('copyEmployeeHandoff').addEventListener('click',async()=>{
  if(!linkAvailable)return;
  const field=$('employeeHandoffValue');
  try{
   await navigator.clipboard.writeText(field.value);
   linkCopied=true;
   $('copyEmployeeHandoffLabel').textContent='Copied';
   $('onboardDeliveryStatus').textContent='Link copied. Share it privately with the named employee.';
   if(copyFeedbackTimer!==null)clearTimeout(copyFeedbackTimer);
   copyFeedbackTimer=setTimeout(()=>{$('copyEmployeeHandoffLabel').textContent='Copy invitation link';copyFeedbackTimer=null;},1800);
  }catch{
   field.focus();field.select();
   $('onboardDeliveryStatus').textContent='Clipboard access is unavailable. Select and copy the invitation URL manually.';
  }
 });
 $('checkEmployeeStatus').addEventListener('click',async()=>{
  if(busy||!uncertainEmail)return;
  busy=true;$('checkEmployeeStatus').disabled=true;
  $('checkEmployeeStatus').textContent='Checking…';
  try{
   const found=await checkExisting(uncertainEmail);
   if(found?.id){
    partialSuccess(values(),found.id,found.status,'An employee with this work email exists. Open Manage access to review the record and its invitation state.');
    return;
   }
   $('onboardRecoveryMessage').textContent='No matching employee was returned, but the original request remains unconfirmed. Check again or ask an administrator to inspect the directory before creating another employee.';
  }catch{
   $('onboardRecoveryMessage').textContent='Employee status is unavailable. Check again or ask an administrator to inspect the directory before creating another employee.';
  }finally{
   busy=false;$('checkEmployeeStatus').disabled=false;$('checkEmployeeStatus').textContent='Check status';
  }
 });
 $('onboardAnother').addEventListener('click',()=>{
  if(!confirmLeave())return;
  clearInvitation();
  uncertainEmail=null;pending=null;editing=null;
  form.reset();
  $('onboardComplete').hidden=true;$('onboardingWizard').hidden=false;
  $('employeeHandoffPanel').hidden=true;$('onboardRecovery').hidden=true;
  $('createdEmployeeSummary').hidden=true;$('setupEmployeeLogin').hidden=true;
  $('onboardDeliveryStatus').textContent='';
  for(const field of form.querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid');
  showStep(0,true);
 });
 showStep(0);
})();
