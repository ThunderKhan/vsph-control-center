(() => {
 'use strict';
 const $=id=>document.getElementById(id),content=$('identityContent'),message=$('identityMessage');
 const employeeId=/^\/employees\/([^/]+)\/account-link\/?$/.exec(location.pathname)?.[1];
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
 let busy=false,requestKey=crypto.randomUUID(),revision=0;
 async function api(path,body,key){
  const r=await fetch('/api/employee-identity'+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));
  if(r.status===401&&!data.code){location.assign('/login');throw Error('Sign in again.');}
  if(!r.ok){const e=Error(data.message||'Account-link operation unavailable.');e.data=data;throw e;}return data;
 }
 function button(title,fn){const b=node('button',title);b.type='button';b.onclick=()=>run(fn);return b;}
 async function run(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('main button'))b.disabled=true;try{await fn();}catch(e){message.textContent=e.message;}finally{busy=false;for(const b of document.querySelectorAll('main button'))b.disabled=false;}}
 async function mutate(action,data){
  if(!confirm(action==='revoke'?'Revoke this account link and any linked HR grant? Customer/product/project assignments and the portal account remain separate.':'Confirm this employee identity request action?'))return;
  await api('/employees/'+employeeId+'/'+action,{...data,confirmed:true},action==='request'?requestKey:null);
  if(action==='request')requestKey=crypto.randomUUID();await load();message.textContent='Account-link request change saved.';
 }
 function manager(data){
  const e=data.employee,box=node('section');box.className='panel';box.append(node('h2',e.fullName),node('p',e.email+' · '+e.status+' · roster version '+e.version));
  box.append(node('p',data.link?.status==='linked'?'Account link accepted. A new HR grant remains an owner-only action.':'No accepted account link. Request consent from the matching active ordinary portal account.'));
  const actions=node('div');actions.className='identity-actions';
  if(data.link?.status==='linked')actions.append(button('Revoke account link',()=>mutate('revoke',{rosterVersion:e.version,linkVersion:data.link.version})));
  else if(['active','onboarding'].includes(e.status))actions.append(button('Request account link',()=>mutate('request',{rosterVersion:e.version})));
  box.append(actions);content.append(box);
  for(const r of data.requests){const row=node('article');row.className='panel';row.append(node('h2','Account-link request'),node('p',r.state+' · version '+r.version+' · expires '+new Date(r.expires_at).toLocaleString()),node('p','Request '+r.id));
   if(['pending','expired'].includes(r.state)){const a=node('div');a.className='identity-actions';for(const [action,label] of [['renew','Renew request'],['cancel','Cancel request']])a.append(button(label,()=>mutate(action,{rosterVersion:e.version,requestId:r.id,requestVersion:r.version})));row.append(a);}content.append(row);
  }
  content.append(node('p','Latest 20 requests. Existing HR grants predating account consent are preserved for owner review. This screen supports existing accounts only; new-identity email enrollment is not implemented here.'));
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
 async function load(){const n=++revision;content.replaceChildren();content.setAttribute('aria-busy','true');try{const data=await api(employeeId?'/employees/'+employeeId:'/mine');if(n!==revision)return;employeeId?manager(data):personal(data);message.textContent='Showing current authorized account-link information.';}catch(e){if(n===revision){content.replaceChildren();message.textContent=e.message;}}finally{if(n===revision)content.setAttribute('aria-busy','false');}}
 $('refreshIdentity').onclick=()=>run(load);load();
})();
