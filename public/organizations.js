(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let workspace=null,orgCursor=null,orgs=[],members=[],busy=false;
 function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
 function message(text){$('message').textContent=text;}
 async function api(path,body){
  const response=await fetch('/api/organizations'+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  if(response.status===401){location.assign('/login');throw Error('Your session expired. Sign in again.');}
  const data=await response.json();if(!response.ok)throw Error(data.message||'Unable to load this organization.');return data;
 }
 function select(labelText,values,current){
  const label=node('label',labelText),input=node('select');
  for(const value of values){const option=node('option',value===''?'Remove product access':value);option.value=value;input.append(option);}
  input.value=current;label.append(input);return {label,input};
 }
 function products(){
  $('products').replaceChildren();$('productLimit').hidden=workspace.productCount<=100;
  for(const product of workspace.products){
   const row=node('article');row.append(node('h3',product.name),node('p',`${product.code} · ${product.status} · access ${product.access_status} · ${product.subscription_status||'no subscription'} · ${product.plan_code||'no plan'}`));
   row.append(node('p',`From ${product.starts_at?new Date(product.starts_at).toLocaleString():'not set'} to ${product.ends_at?new Date(product.ends_at).toLocaleString():'no end date'}. ${product.effective?'Currently effective.':'Currently unavailable.'}`));
   if(!product.can_assign)row.append(node('p','Assigning product roles requires your own explicit product administrator role.'));
   $('products').append(row);
  }
  if(!workspace.products.length)$('products').append(node('p','No products are assigned to this organization.'));
 }
 function renderMembers(){
  $('members').replaceChildren();$('nextMembers').hidden=members.length<50;
  for(const member of members){
   const row=node('article');row.className='panel';
   row.append(node('h3',member.full_name),node('p',`${member.email} · ${member.role} · ${member.status} · account ${member.account_status}`));
   if(member.manageable&&member.status!=='invited'){
    const form=node('form'),role=select(`Organization role for ${member.email}`,workspace.actorRole==='owner'?['admin','member','viewer']:['member','viewer'],member.role),status=select(`Membership status for ${member.email}`,['active','suspended'],member.status),button=node('button','Review membership change');button.type='submit';
    form.append(role.label,status.label,button);form.addEventListener('submit',event=>{event.preventDefault();mutate('member',{userId:member.user_id,version:member.version,role:role.input.value,status:status.input.value,confirmed:true},`Change ${member.email} to ${role.input.value}, ${status.input.value}? Existing product sessions will be revoked.`);});row.append(form);
    if(member.status==='active')for(const product of workspace.products){
     const current=member.product_roles.find(r=>r.applicationId===product.id)?.role||'';
     if(!product.effective||!product.can_assign||current==='super_admin')continue;
     const accessForm=node('form'),selection=select(`${product.name} role for ${member.email}`,['',...(product.roles||[])],current),save=node('button','Review '+product.name+' access');save.type='submit';accessForm.append(selection.label,save);
     accessForm.addEventListener('submit',event=>{event.preventDefault();mutate('role',{userId:member.user_id,version:member.version,applicationId:product.id,role:selection.input.value,confirmed:true},`Change ${product.name} access for ${member.email}? Existing product sessions will be revoked.`);});row.append(accessForm);
    }
   }
   const assigned=member.product_roles.map(r=>(workspace.products.find(p=>p.id===r.applicationId)?.name||'Assigned product')+': '+r.role);
   row.append(node('p',assigned.length?assigned.join(' · '):'No individual product roles.'));$('members').append(row);
  }
  if(!members.length)$('members').append(node('p','No members on this page.'));
 }
 async function loadMembers(cursor=null){members=await api('/'+$('organization').value+'/members'+(cursor?'?afterId='+encodeURIComponent(cursor):''));renderMembers();}
 async function loadWorkspace(){
  const id=$('organization').value;$('detail').hidden=true;workspace=null;members=[];if(!id)return;
  const next=await api('/'+id);workspace=next;
  $('organizationName').textContent=next.organization.name;$('summary').textContent=`${next.organization.slug} · ${next.organization.status} · your role: ${next.actorRole}`;
  $('counts').textContent=`${next.counts.activeMembers} active · ${next.counts.invitedMembers} invited · ${next.counts.suspendedMembers} suspended members`;
  $('profile').elements.name.value=next.organization.name;products();$('activity').replaceChildren();
  for(const entry of next.activity)$('activity').append(node('p',new Date(entry.created_at).toLocaleString()+' · '+entry.action));
  if(!next.activity.length)$('activity').append(node('p','No organization workspace changes recorded.'));
  await loadMembers();$('detail').hidden=false;
 }
 async function loadOrganizations(cursor=null){
  const selected=$('organization').value;orgs=await api(cursor?'?afterId='+encodeURIComponent(cursor):'');orgCursor=cursor;
  $('organization').replaceChildren(node('option','Select an organization'));$('organization').firstChild.value='';
  for(const org of orgs){const option=node('option',org.name);option.value=org.id;$('organization').append(option);}
  $('organization').value=orgs.some(o=>o.id===selected)?selected:(orgs[0]?.id||'');$('nextOrganizations').hidden=orgs.length<100;$('empty').hidden=orgs.length>0;await loadWorkspace();
 }
 async function run(fn){
  if(busy)return;busy=true;$('detail').setAttribute('aria-busy','true');message('');
  const disabled=[...document.querySelectorAll('button,input,select')].filter(el=>!el.disabled);for(const el of disabled)el.disabled=true;
  try{await fn();}catch(error){message(error.message);}finally{for(const el of disabled)el.disabled=false;busy=false;$('detail').setAttribute('aria-busy','false');}
 }
 async function mutate(action,data,confirmation){
  if(busy||!workspace||!window.confirm(confirmation))return;
  const id=$('organization').value;await run(async()=>{await api('/'+id+'/'+action,data);await loadWorkspace();message('Organization updated.');});
 }
 $('profile').addEventListener('submit',event=>{event.preventDefault();if(!workspace)return;mutate('profile',{version:workspace.organization.version,name:$('profile').elements.name.value},'Save this organization display name?');});
 $('organization').addEventListener('change',()=>run(loadWorkspace));$('refresh').addEventListener('click',()=>run(()=>loadOrganizations(orgCursor)));
 $('firstOrganizations').addEventListener('click',()=>run(()=>loadOrganizations()));$('nextOrganizations').addEventListener('click',()=>run(()=>loadOrganizations(orgs.at(-1)?.id)));
 $('firstMembers').addEventListener('click',()=>run(()=>loadMembers()));$('nextMembers').addEventListener('click',()=>run(()=>loadMembers(members.at(-1)?.user_id)));
 run(()=>loadOrganizations());
})();
