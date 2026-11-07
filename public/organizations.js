(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let workspace=null,orgCursor=null,orgs=[],members=[],busy=false,pendingInvite=null,ownershipReview=null;
 function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
 function message(text){$('message').textContent=text;}
 async function api(path,body,headers={}){
  const response=await fetch('/api/organizations'+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(response.status===401&&!['MFA_REQUIRED','MFA_INVALID','INVALID_CREDENTIALS','IDENTITY_MISMATCH'].includes(data.code)){location.assign('/login');throw Error('Your session expired. Sign in again.');}
  if(!response.ok){const error=Error(data.message||'Unable to load this organization.');error.code=data.code;error.factors=data.factors;throw error;}return data;
 }
 function select(labelText,values,current,emptyText='Remove product access'){
  const label=node('label',labelText),input=node('select');input.setAttribute('aria-label',labelText);
  for(const value of values){const option=node('option',value===''?emptyText:value);option.value=value;input.append(option);}
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
  ownershipReview=null;$('ownershipReview').hidden=true;$('ownershipTransfer').reset();$('ownershipMfa').hidden=true;$('ownershipCode').required=false;
  $('ownershipPanel').hidden=workspace.actorRole!=='owner';$('ownershipTarget').replaceChildren();
  for(const member of members.filter(m=>m.manageable&&m.role==='admin'&&m.status==='active'&&m.account_status==='active')){const option=node('option',member.full_name+' · '+member.email);option.value=member.user_id;$('ownershipTarget').append(option);}
  $('ownershipEmpty').hidden=$('ownershipTarget').options.length>0;$('reviewOwnership').hidden=!$('ownershipTarget').options.length;
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
  await loadMembers();await loadInvitations();$('detail').hidden=false;
 }
 async function loadOrganizations(cursor=null){
  const selected=$('organization').value;orgs=await api(cursor?'?afterId='+encodeURIComponent(cursor):'');orgCursor=cursor;
  $('organization').replaceChildren(node('option','Select an organization'));$('organization').firstChild.value='';
  for(const org of orgs){const option=node('option',org.name);option.value=org.id;$('organization').append(option);}
  $('organization').value=orgs.some(o=>o.id===selected)?selected:(orgs[0]?.id||'');$('nextOrganizations').hidden=orgs.length<100;$('empty').hidden=orgs.length>0;await loadWorkspace();
 }
 async function run(fn){
  if(busy)return;busy=true;$('detail').setAttribute('aria-busy','true');message('');
  const disabled=[...document.querySelectorAll('main button, main input, main select')].filter(el=>!el.disabled);for(const el of disabled)el.disabled=true;
  try{await fn();}catch(error){message(error.message);}finally{for(const el of disabled)el.disabled=false;busy=false;$('detail').setAttribute('aria-busy','false');}
 }
 async function mutate(action,data,confirmation){
  if(busy||!workspace||!await VSPHUI.confirm(confirmation,{title:"Confirm organization change?"}))return;
  const id=$('organization').value;await run(async()=>{await api('/'+id+'/'+action,data);await loadWorkspace();message('Organization updated.');});
 }
 async function loadInvitations(){
  const form=$('invite'),role=form.elements.memberRole;role.replaceChildren();
  for(const value of workspace.actorRole==='owner'?['member','viewer','admin']:['member','viewer']){const option=node('option',value);option.value=value;role.append(option);}
  $('inviteProducts').replaceChildren();
  for(const product of workspace.products.filter(p=>p.effective&&p.can_assign)){
   const field=select('Invitation '+product.name+' role',['',...(product.roles||[])],'','No product role');field.input.dataset.product=product.id;$('inviteProducts').append(field.label);
  }
  const invitations=await api('/'+$('organization').value+'/invitations');$('invitations').replaceChildren();
  for(const invite of invitations){
   const row=node('article');row.append(node('h3',invite.email),node('p',`${invite.state}${invite.expired?' (expired)':''} · delivery ${invite.delivery_state} · attempts ${invite.attempts} · expires ${new Date(invite.expires_at).toLocaleString()}`));
   if(invite.failure_code)row.append(node('p','Delivery requires review: '+invite.failure_code));
   if(!['accepted','accepting','requires_attention'].includes(invite.state))for(const action of ['reissue','cancel']){
    const button=node('button',(action==='reissue'?'Reissue ':'Cancel ')+invite.email);button.addEventListener('click',async()=>{
     if(busy||!await VSPHUI.confirm(`${action==='reissue'?'Replace the invitation link':'Cancel this invitation'} for ${invite.email}? Previous links will stop working.`))return;
     run(async()=>{await api('/'+$('organization').value+'/invitations/'+invite.id+'/'+action,{generation:invite.generation,confirmed:true});await loadWorkspace();message('Invitation updated.');});
    });row.append(button);
   }else row.append(node('p','Accepted or ambiguous invitations cannot be changed here. Contact VSPH for recovery.'));
   $('invitations').append(row);
  }
  if(!invitations.length)$('invitations').append(node('p','No invitations issued by you for this organization.'));
 }
 $('invite').addEventListener('submit',event=>{
  event.preventDefault();if(busy||!workspace)return;
  const form=$('invite'),body={name:form.elements.name.value,email:form.elements.email.value,memberRole:form.elements.memberRole.value,products:[...$('inviteProducts').querySelectorAll('select')].filter(el=>el.value).map(el=>({applicationId:el.dataset.product,role:el.value}))},id=$('organization').value,signature=JSON.stringify({id,body});
  if(pendingInvite?.signature!==signature)pendingInvite={signature,key:crypto.randomUUID()};
  const key=pendingInvite.key;run(async()=>{await api('/'+id+'/invitations',body,{'Idempotency-Key':key});pendingInvite=null;form.reset();await loadWorkspace();message('Invitation queued. Delivery is not confirmed.');});
 });
 $('profile').addEventListener('submit',event=>{event.preventDefault();if(!workspace)return;mutate('profile',{version:workspace.organization.version,name:$('profile').elements.name.value},'Save this organization display name?');});
 $('ownershipTarget').addEventListener('change',()=>{ownershipReview=null;$('ownershipReview').hidden=true;$('ownershipTransfer').reset();});
 $('reviewOwnership').addEventListener('click',()=>run(async()=>{
  if(!workspace||!$('ownershipTarget').value)return;
  ownershipReview=await api('/'+$('organization').value+'/ownership/preview?targetUserId='+encodeURIComponent($('ownershipTarget').value));
  $('ownershipImpact').textContent=`Transfer ownership to ${ownershipReview.targetName} (${ownershipReview.targetEmail}). You will become an administrator. Both members' existing product sessions will be revoked. No product role or project access is granted.`;
  $('ownershipReview').hidden=false;
 }));
 $('ownershipTransfer').addEventListener('submit',event=>{
  event.preventDefault();if(busy||!ownershipReview||!$('ownershipConfirmed').checked)return;
  const intent={targetUserId:ownershipReview.targetUserId,organizationVersion:ownershipReview.organizationVersion,ownerVersion:ownershipReview.ownerVersion,targetVersion:ownershipReview.targetVersion},id=$('organization').value;
  const credentials={password:$('ownershipPassword').value,...($('ownershipCode').value?{totpCode:$('ownershipCode').value,totpFactorId:$('ownershipFactor').value}:{})};
  run(async()=>{try{
   const grant=await api('/'+id+'/ownership/reauthenticate',{...intent,...credentials});
   await api('/'+id+'/ownership/transfer',{...intent,confirmed:true},{'X-VSPH-Step-Up':grant.proof});
   await loadWorkspace();message('Ownership transferred. Your organization role is now administrator.');
  }catch(error){
   if(error.code==='MFA_REQUIRED'&&Array.isArray(error.factors)){
    $('ownershipFactor').replaceChildren();for(const f of error.factors){const option=node('option',f.name);option.value=f.id;$('ownershipFactor').append(option);}
    $('ownershipMfa').hidden=false;$('ownershipCode').required=true;
   }
   throw error;
  }finally{$('ownershipPassword').value='';$('ownershipCode').value='';}});
 });
 $('organization').addEventListener('change',()=>run(loadWorkspace));$('refresh').addEventListener('click',()=>run(()=>loadOrganizations(orgCursor)));
 $('firstOrganizations').addEventListener('click',()=>run(()=>loadOrganizations()));$('nextOrganizations').addEventListener('click',()=>run(()=>loadOrganizations(orgs.at(-1)?.id)));
 $('firstMembers').addEventListener('click',()=>run(()=>loadMembers()));$('nextMembers').addEventListener('click',()=>run(()=>loadMembers(members.at(-1)?.user_id)));
 run(()=>loadOrganizations());
})();
