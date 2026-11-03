(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const label={full_time:'Full-time',part_time:'Part-time',intern:'Intern',contract:'Contract',
  onboarding:'Onboarding',active:'Active',on_leave:'On leave',inactive:'Inactive'};
 let current=null,selected=null,cursor=null,lastCursor=null,busy=false,searchVersion=0;
 const text=(tag,value,cls='')=>{const el=document.createElement(tag);el.textContent=String(value??'');if(cls)el.className=cls;return el;};
 const info=message=>{$('peopleMessage').textContent=message;};
 async function api(path,body=null,extra={}){
  const response=await fetch('/api/employees'+path,{
   credentials:'same-origin',cache:'no-store',
   ...(body?{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)}:{})
  });
  if(response.status===401){location.assign('/login');throw Error('Your session expired.');}
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.code==='SCHEMA_NOT_READY'?'The employee migration has not been installed on this database.':result.message||'Employee operation was denied. Reload and retry.');
  return result;
 }
 function drawStats(stats){
  const ids={staffTotal:'total',staffActive:'active',staffOnboarding:'onboarding',staffLeave:'onLeave',staffHr:'hrManagers'};
  for(const [id,key] of Object.entries(ids))$(id).textContent=Number(stats[key]||0).toLocaleString('en-IN');
 }
 function drawDepartments(items){
  const parent=$('departmentChart');parent.replaceChildren();
  if(!items.length){parent.append(text('p','No active team assignments in the roster yet.','muted'));return;}
  const highest=Math.max(1,...items.map(d=>Number(d.members)||0));
  for(const department of items){
   const row=text('div','','people-dept-row'),title=text('strong',department.department),
    track=text('span','','people-dept-track'),bar=text('span','','people-dept-fill'),
    count=text('span',department.members,'people-dept-count');
   const percent=Math.max(0,Math.min(100,(Number(department.members)||0)/highest*100));
   bar.style.width=percent.toFixed(1)+'%';
   track.append(bar);row.append(title,track,count);parent.append(row);
  }
 }
 function makeButton(value,callback){
  const b=text('button',value,'people-secondary');b.type='button';b.addEventListener('click',callback);return b;
 }
 function edit(employee){
  selected=employee;
  const form=$('employeeEditForm');
  form.elements.fullName.value=employee.full_name;
  form.elements.department.value=employee.department;
  form.elements.jobTitle.value=employee.job_title;
  form.elements.employmentType.value=employee.employment_type;
  form.elements.startDate.value=employee.start_date;
  form.elements.status.value=employee.status;
  form.elements.confirmed.checked=false;
  $('editEmail').textContent=employee.email+' · version '+employee.version;
  $('employeeEditPanel').hidden=false;
  $('employeeEditPanel').scrollIntoView({block:'nearest',behavior:'auto'});
  form.elements.fullName.focus();
 }
 async function changeHR(employee,action){
  const question=action==='grant_hr'
   ?'Grant HR employee-management authority to '+employee.email+'? Only an existing active portal account matching this email is eligible.'
   :'Revoke HR employee-management authority from '+employee.email+'?';
  if(!window.confirm(question))return;
  await run(async()=>{
   await api('/'+employee.id+'/'+action,{version:employee.version,confirmed:true});
   info('HR permission updated.');await load(cursor);
  });
 }
 function drawEmployees(records,role){
  const parent=$('employeeRows');parent.replaceChildren();
  const hasMore=records.length>50,items=records.slice(0,50);
  lastCursor=hasMore&&items.length?items[items.length-1].id:null;
  $('nextEmployeePage').disabled=!hasMore;
  $('employeePageSummary').textContent=(items.length?'Showing '+items.length:'No')+' employees on this page'+(hasMore?' · more available':'');
  if(!items.length){const tr=document.createElement('tr'),td=text('td','No employees match these filters.');td.colSpan=6;tr.append(td);parent.append(tr);return;}
  for(const employee of items){
   const row=document.createElement('tr'),name=document.createElement('td');
   name.append(text('strong',employee.full_name),text('small',employee.email));
   const position=document.createElement('td');position.append(text('strong',employee.department),text('small',employee.job_title));
   const type=text('td',label[employee.employment_type]||employee.employment_type);
   const status=document.createElement('td'),pill=text('span',label[employee.status]||employee.status,'people-status');pill.dataset.state=employee.status;status.append(pill);
   const access=text('td',employee.is_hr?'HR manager':'Roster only');
   const actions=document.createElement('td');
   const canEdit=role==='owner'||!employee.is_hr;
   if(canEdit)actions.append(makeButton('Edit',()=>edit(employee)));
   if(role==='owner'&&employee.status==='active')actions.append(makeButton(employee.is_hr?'Revoke HR':'Grant HR',()=>changeHR(employee,employee.is_hr?'revoke_hr':'grant_hr')));
   if(!canEdit)actions.append(text('span','Owner managed','muted'));
   row.append(name,position,type,status,access,actions);parent.append(row);
  }
 }
 function drawManagers(list){
  const parent=$('hrManagers');parent.replaceChildren();
  if(!list.length){parent.append(text('p','No HR managers assigned. Grant HR from an active employee row.','muted'));return;}
  for(const manager of list){
   const row=text('div','','people-hr-entry'),detail=document.createElement('div');
   detail.append(text('strong',manager.full_name),text('span',manager.email+' · '+manager.status+' roster · '+manager.account_status+' account'));
   row.append(detail);
   if(manager.status!=='inactive')row.append(makeButton('Revoke HR',()=>changeHR({id:manager.employee_id,version:manager.version,email:manager.email,is_hr:true},'revoke_hr')));
   parent.append(row);
  }
 }
 async function load(afterId=null){
  const currentLoad=++searchVersion;
  const query=new URLSearchParams();
  if(afterId)query.set('afterId',afterId);
  const term=$('employeeSearch').value.trim(),status=$('employeeStatus').value;
  if(term)query.set('search',term);
  if(status!=='all')query.set('status',status);
  $('employeeRows').setAttribute('aria-busy','true');
  try{
   const result=await api('/'+(query.toString()?'?'+query:''));
   if(currentLoad!==searchVersion)return;
   current=result;cursor=afterId;
   drawStats(result.counts);drawDepartments(result.departments||[]);
   drawEmployees(result.employees||[],result.role);
   $('staffRole').textContent=result.role==='owner'?'Platform owner':'HR manager';
   $('staffAuthority').textContent=result.role==='owner'
    ?'Full internal workforce governance, including HR assignments.'
    :'Employee onboarding and ordinary staff updates. HR role administration remains owner-only.';
   $('hrGovernance').hidden=!result.canManageHr;
   if(result.canManageHr)drawManagers(result.hrManagers||[]);
   info('Showing current records from the employee database.');
  }catch(error){if(currentLoad===searchVersion){info(error.message);$('employeeRows').replaceChildren();$('employeeRows').append(document.createElement('tr'));$('nextEmployeePage').disabled=true;}}
  finally{if(currentLoad===searchVersion)$('employeeRows').setAttribute('aria-busy','false');}
 }
 async function run(action){
  if(busy)return;busy=true;const controls=[...document.querySelectorAll('button')].filter(x=>!x.disabled);
  for(const control of controls)control.disabled=true;
  try{await action();}catch(error){info(error.message);}
  finally{busy=false;for(const control of controls)control.disabled=false;}
 }
 $('employeeEditForm').addEventListener('submit',event=>{
  event.preventDefault();
  if(!selected||busy)return;
  const form=$('employeeEditForm');
  if(!form.reportValidity())return;
  if(!window.confirm('Save changes to '+selected.email+'? Roster status does not automatically disable a portal login.'))return;
  const body={
   fullName:form.elements.fullName.value,department:form.elements.department.value,
   jobTitle:form.elements.jobTitle.value,employmentType:form.elements.employmentType.value,
   startDate:form.elements.startDate.value,status:form.elements.status.value,
   version:selected.version,confirmed:form.elements.confirmed.checked
  };
  run(async()=>{
   await api('/'+selected.id+'/update',body);
   selected=null;$('employeeEditPanel').hidden=true;await load(cursor);info('Employee record updated.');
  });
 });
 $('cancelEdit').addEventListener('click',()=>{selected=null;$('employeeEditPanel').hidden=true;});
 $('refreshEmployees').addEventListener('click',()=>load(cursor));
 $('firstEmployeePage').addEventListener('click',()=>load(null));
 $('nextEmployeePage').addEventListener('click',()=>{if(lastCursor)load(lastCursor);});
 let debounce;
 $('employeeSearch').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>load(null),260);});
 $('employeeStatus').addEventListener('change',()=>load(null));
 load();
})();
