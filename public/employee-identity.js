(() => {
 'use strict';
 const $=id=>document.getElementById(id),content=$('identityContent'),message=$('identityMessage');
 const employeeId=/^\/employees\/([^/]+)\/account-link\/?$/.exec(location.pathname)?.[1];
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
 let busy=false,requestKey=crypto.randomUUID(),revision=0;
 async function api(path,body,key,base='/api/employee-identity'){
  const r=await fetch(base+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));
  if(r.status===401&&!data.code){location.assign('/login');throw Error('Sign in again.');}
  if(!r.ok){const e=Error(data.message||'Account-link operation unavailable.');e.data=data;throw e;}return data;
 }
 function button(title,fn){const b=node('button',title);b.type='button';b.onclick=()=>run(fn);return b;}
 async function run(fn){if(busy)return;busy=true;const controls=[...document.querySelectorAll('main button')].filter(b=>!b.disabled);for(const b of controls)b.disabled=true;try{await fn();}catch(e){message.textContent=e.message;}finally{busy=false;for(const b of controls)if(b.isConnected)b.disabled=false;}}
 async function mutate(action,data){
  if(!await VSPHUI.confirm(action==='revoke'?'Revoke this account link and any linked HR grant? Customer/product/project assignments and the portal account remain separate.':'Confirm this employee identity request action?'))return;
  await api('/employees/'+employeeId+'/'+action,{...data,confirmed:true},action==='request'?requestKey:null);
  if(action==='request')requestKey=crypto.randomUUID();await load();message.textContent='Account-link request change saved.';
 }
 function manager(data,enrollment,temporary){
  const e=data.employee,linked=data.link?.status==='linked',state=enrollment?.enrollment?.state;
  $('identityTitle').textContent='Employee account & access';
  const hero=node('section');hero.className='identity-dashboard-hero';
  const avatar=node('div',e.fullName.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase());avatar.className='identity-avatar';avatar.setAttribute('aria-hidden','true');
  const person=node('div');person.className='identity-person';
  person.append(node('h2',e.fullName),node('p',e.email));
  hero.append(avatar,person);content.append(hero);

  const statuses=node('section');statuses.className='identity-status-grid';statuses.setAttribute('aria-label','Current employee status');
  function statusCard(label,value,note,kind){
   const card=node('div');card.className='identity-status-card';
   const caption=node('span',label),heading=node('strong',value),hint=node('small',note);
   heading.dataset.state=kind;
   card.append(caption,heading,hint);statuses.append(card);
  }
  const loginLabel=linked?'Accepted':state==='ready'?'Invitation pending':state==='accepted'?'Accepted':state?'Setup needs attention':'Not linked';
  statusCard('Login setup',loginLabel,linked?'Account link accepted':state==='ready'?'Employee has not completed setup':'Account access is managed separately',linked?'success':'neutral');
  statusCard('Employment status',(e.status||'unknown').replaceAll('_',' ').replace(/^\w/,c=>c.toUpperCase()),e.status==='active'?'Roster active':'Workforce activation is separate',e.status==='active'?'success':'neutral');
  content.append(statuses);

  if(linked&&e.status==='onboarding'){
   const next=node('section');next.className='identity-next-step';
   next.append(node('h3','Next step: Activate employee'),node('p','The account link was accepted, but the employee record is still marked Onboarding.'));
   const action=node('a','Manage employment status');
   action.className='identity-primary-action';
   action.href='/employees?search='+encodeURIComponent(e.email)+'&edit='+encodeURIComponent(e.id);
   next.append(action);content.append(next);
  }

  const access=node('section');access.className='identity-dashboard-panel';
  access.append(node('h3','Access & permissions'));
  const caption=node('p',linked?'The employee has accepted their personal account link. HR authority and customer or project access still require separate approval.':'Account linking and HR permissions are governed independently.');
  caption.className='identity-muted';access.append(caption);
  if(data.hrReadiness){
   const readiness=data.hrReadiness,section=node('section');section.className='identity-permission';
   section.setAttribute('aria-label','HR appointment readiness');
   section.append(node('strong','HR authority'),node('p',readiness.message));
   if(readiness.canGrant)section.append(button('Grant HR',async()=>{
    if(!await VSPHUI.confirm('Grant internal HR administration to '+e.email+'? Customer and product roles remain separate.'))return;
    const response=await fetch('/api/employees/'+e.id+'/grant_hr',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:e.version,confirmed:true})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.message||'HR grant failed. Refresh the current record.');
    await load();message.textContent='HR authority granted. The employee can open the HR workspace on their next request.';
   }));
   access.append(section);
  }else{
   const hint=node('div');hint.className='identity-permission';hint.append(node('strong','HR authority'),node('p','HR permissions can be granted only by an authorized platform owner.'));access.append(hint);
  }
  if(linked){
   const actions=node('div');actions.className='identity-actions';
   actions.append(button('Revoke employee account link',()=>mutate('revoke',{rosterVersion:e.version,linkVersion:data.link.version})));
   access.append(actions);
   const note=node('p','Revoking an employee link does not automatically disable an unrelated portal login or customer access.');
   note.className='identity-muted';access.append(note);
  }else if(['active','onboarding'].includes(e.status)){
   const actions=node('div');actions.className='identity-actions';
   const request=button('Request account link',()=>mutate('request',{rosterVersion:e.version}));
   if(data.hrReadiness&&!data.hrReadiness.canRequest){request.disabled=true;request.title='Review employee enrollment or pending consent first.';}
   actions.append(request);access.append(actions);
  }
  content.append(access);

  if(temporary?.credential)content.append(credentialPanel(e,enrollment,temporary.credential));
  else if(enrollment?.available&&!linked)content.append(enrollmentPanel(e,enrollment,temporary));
  else if(enrollment?.message){const note=node('p',enrollment.message);note.className='identity-muted';content.append(note);}

  const history=node('section');history.className='identity-dashboard-panel';
  history.append(node('h3','Account activity'));
  const details=node('details');details.className='identity-activity';
  const heading=node('summary',(data.requests?.length||0)+' account-link request'+(data.requests?.length===1?'':'s')+' · View history');
  details.append(heading);
  const list=node('div');list.className='identity-history-list';
  for(const r of data.requests||[]){
   const row=node('article');row.className='identity-history-row';
   const state=node('strong',String(r.state||'Unknown').replace(/^\w/,c=>c.toUpperCase()));
   const date=node('span',r.state==='accepted'?'Link accepted':'Request status: '+r.state);
   const expiry=r.expires_at?node('small','Original expiry: '+new Date(r.expires_at).toLocaleString()):null;
   row.append(state,date);if(expiry)row.append(expiry);
   if(['pending','expired'].includes(r.state)){
    const actions=node('div');actions.className='identity-actions';
    for(const [action,label] of [['renew','Renew request'],['cancel','Cancel request']]){
     actions.append(button(label,()=>mutate(action,{rosterVersion:e.version,requestId:r.id,requestVersion:r.version})));
    }
    row.append(actions);
   }
   list.append(row);
  }
  if(!list.childElementCount)list.append(node('p','No account-link requests recorded.'));
  details.append(list);history.append(details);
  const technical=node('details');technical.className='identity-technical';
  technical.append(node('summary','Technical details'));
  technical.append(node('p','Roster version: '+e.version));
  for(const r of data.requests||[])technical.append(node('p','Request ID: '+r.id+' · version '+r.version));
  history.append(technical);content.append(history);
 }
 function enrollmentPanel(employee,data,temporary){
  const panel=node('section');panel.className='identity-readiness';panel.append(node('h3','Employee login invitation'));
  const r=data.enrollment;panel.append(node('p',r?'Status: '+r.state+' · expires '+new Date(r.expiresAt).toLocaleString():'Create a new ordinary portal account for this work email. The employee will choose their password and accept the employment link.'));
  panel.append(node('p','Share the private link only with the named employee. Email submission is optional when an approved sender is configured; provider acceptance is not proof of inbox delivery. Activate the roster separately before assigning work.'));
  const actions=node('div');actions.className='identity-actions';
  async function issue(delivery='manual'){
   if(!await VSPHUI.confirm((delivery==='email'?'Submit an email invitation for ':'Create or reissue a private invitation for ')+employee.email+'? No HR or customer access is granted.'))return;
   const result=await api(r?'/'+r.id+'/renew':'/employees/'+employee.id,{rosterVersion:employee.version,confirmed:true,...(delivery==='email'?{delivery:'email'}:{}),...(r?{version:r.version}:{})},r?null:requestKey,'/api/employee-enrollment');
   requestKey=crypto.randomUUID();await load();message.textContent=result.emailDelivery?.message||result.message;
   if(result.url){const secret=node('section');secret.className='panel';secret.append(node('h2','Private employee setup link'),node('p','Copy now and deliver privately. This link is shown only for this issuance; refreshing clears it.'));
    const label=node('label','Employee setup link'),input=node('textarea');input.readOnly=true;input.value=result.url;input.rows=4;label.append(input);secret.append(label,button('Copy private link',async()=>{try{await navigator.clipboard.writeText(result.url);message.textContent='Copied. Deliver only to the named employee.';}catch{input.focus();input.select();message.textContent='Select and copy the private link.';}}));content.prepend(secret);
   }
  }
  if(!r||['provisioning','ready','expired','cancelled'].includes(r.state)){
   actions.append(button(r?'Reissue login invitation':'Create login invitation',()=>issue('manual')));
   if(data.emailDeliveryAvailable)actions.append(button(r?'Reissue and email invitation':'Email login invitation',()=>issue('email')));
   else panel.append(node('p','Email sending is not configured. Use the private link now, or configure the approved employee email webhook before reissuing for email delivery.'));
  }
  if(r&&['provisioning','ready','expired','accepting','recovery_required'].includes(r.state))actions.append(button('Cancel login invitation',async()=>{if(!await VSPHUI.confirm('Cancel this employee login invitation? Existing accepted accounts are unaffected.'))return;await api('/'+r.id+'/cancel',{rosterVersion:employee.version,version:r.version,confirmed:true},null,'/api/employee-enrollment');await load();}));
  if(r&&['accepting','recovery_required'].includes(r.state))panel.append(node('p','Password setup needs operator reconciliation. The new portal identity remains disabled. Automatic retries are blocked to prevent a late provider request changing an active password.'));
  if(temporary&&!temporary.message&&(!r||['provisioning','ready','expired','cancelled'].includes(r.state)))actions.append(button('Create temporary credentials',()=>createCredentials(employee,data,null)));
  panel.append(actions);return panel;
 }
 async function createCredentials(employee,enrollment,credential){
  if(!await VSPHUI.confirm((credential?'Reissue':'Create')+' private temporary credentials for '+employee.email+'? The employee must choose a different personal password before access. No email will be sent.'))return;
  const result=await api('/employees/'+employee.id,{rosterVersion:employee.version,confirmed:true,...(credential?{credentialVersion:credential.version}:{}),...(enrollment?.enrollment?{enrollmentVersion:enrollment.enrollment.version}:{})},requestKey,'/api/employee-credentials');requestKey=crypto.randomUUID();await load();message.textContent=result.message;
  if(result.temporaryPassword){const panel=node('section');panel.className='panel';panel.append(node('h2','Private temporary credentials'),node('p','Shown once. Give these only to the named employee in person or through a trusted private channel. HR should never ask for their later personal password.'));
   const details='Sign in: '+result.loginUrl+'\nWork email: '+result.email+'\nTemporary password: '+result.temporaryPassword+'\nExpires: '+new Date(result.expiresAt).toLocaleString()+'\nYou must change this temporary password at first sign-in.';
   const label=node('label','Employee credential handoff'),field=node('textarea');field.readOnly=true;field.rows=8;field.value=details;label.append(field);panel.append(label,button('Copy handoff details',async()=>{try{await navigator.clipboard.writeText(details);message.textContent='Copied. Deliver privately to the named employee.';}catch{field.focus();field.select();message.textContent='Select and copy the private handoff details.';}}));content.prepend(panel);
  }
 }
 function credentialPanel(employee,enrollment,credential){
  const panel=node('section');panel.className='identity-readiness';panel.append(node('h3','Temporary employee credentials'),node('p','Status: '+credential.state+' · expires '+new Date(credential.expiresAt).toLocaleString()),node('p','The temporary password is never displayed again after refresh. The employee must replace it before portal access. Reissue invalidates earlier temporary passwords and password-setup sessions. Activate the roster separately before assigned-work access.'));
  const actions=node('div');actions.className='identity-actions';if(credential.canReissue)actions.append(button('Reissue temporary credentials',()=>createCredentials(employee,enrollment,credential)));
  const r=enrollment?.enrollment;if(r&&!['accepted','cancelled'].includes(r.state))actions.append(button('Cancel temporary credentials',async()=>{if(!await VSPHUI.confirm('Cancel these temporary employee credentials?'))return;await api('/'+r.id+'/cancel',{rosterVersion:employee.version,version:r.version,confirmed:true},null,'/api/employee-enrollment');await load();}));panel.append(actions);return panel;
 }
 function personal(data){
  $('identityTitle').textContent='My employment';
  for(const e of data.employment){const row=node('article');row.className='panel';row.append(node('h2',e.full_name),node('p',e.department+' · '+e.job_title+' · '+e.status),node('p','Start date '+e.start_date));content.append(row);}
  for(const r of data.requests){
   const row=node('article');row.className='panel';row.append(node('h2',r.full_name+' — account-link request'),node('p',r.department+' · '+r.job_title+' · expires '+new Date(r.expires_at).toLocaleString()));
   if(r.current_roster_version!==r.roster_version){row.append(node('p','This roster changed. Ask the issuer to renew the request before accepting.'));content.append(row);continue;}
   const form=node('form');form.className='identity-form';const password=node('input');password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=4096;
   const label=node('label','Confirm your password');label.append(password);
   const mfa=node('div');mfa.hidden=true;const code=node('input');code.inputMode='numeric';code.autocomplete='one-time-code';code.maxLength=6;code.pattern='[0-9]{6}';const codeLabel=node('label','Authenticator code');codeLabel.append(code);
   const factors=node('select');factors.setAttribute('aria-label','Authenticator');const factorLabel=node('label','Authenticator');factorLabel.append(factors);mfa.append(codeLabel,factorLabel);
   const confirmed=node('input');confirmed.type='checkbox';confirmed.required=true;const confirmLabel=node('label','I agree to link my existing account to this employee record.');confirmLabel.className='identity-confirm';confirmLabel.prepend(confirmed);
   const submit=node('button','Accept account link');submit.type='submit';form.append(label,mfa,confirmLabel,submit);
   form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;
    const secret=password.value,otp=code.value;password.value='';code.value='';
    await run(async()=>{try{await api('/requests/'+r.id+'/accept',{rosterVersion:r.roster_version,requestVersion:r.version,confirmed:true,password:secret,...(otp?{totpCode:otp}:{}),...(factors.value?{totpFactorId:factors.value}:{})});await load();message.textContent='Account link accepted. No access roles were granted.';}
     catch(e){if(e.data?.code==='MFA_REQUIRED'){mfa.hidden=false;code.required=true;factors.replaceChildren();for(const f of e.data.factors||[]){const option=node('option',f.name);option.value=f.id;factors.append(option);}password.focus();}throw e;}});
   };row.append(form);content.append(row);
  }
  if(!data.employment.length&&!data.requests.length)content.append(node('p','No active employment link or eligible account-link request is available. Ask VSPH to review your roster/account mapping.'));
 }
 async function load(){const n=++revision;content.replaceChildren();content.setAttribute('aria-busy','true');try{const data=await api(employeeId?'/employees/'+employeeId:'/mine');let enrollment,temporary;if(employeeId){try{enrollment=await api('/employees/'+employeeId,null,null,'/api/employee-enrollment');}catch(error){enrollment={message:error.message};}try{temporary=await api('/employees/'+employeeId,null,null,'/api/employee-credentials');}catch(error){temporary={message:error.message};}}if(n!==revision)return;employeeId?manager(data,enrollment,temporary):personal(data);message.textContent='';}catch(e){if(n===revision){content.replaceChildren();message.textContent=e.message;}}finally{if(n===revision)content.setAttribute('aria-busy','false');}}
 $('refreshIdentity').onclick=()=>run(load);load();
})();
