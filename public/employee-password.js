(() => {
 const $=id=>document.getElementById(id),form=$('passwordSetupForm'),message=$('passwordSetupMessage'),submit=$('savePersonalPassword');let busy=false;
 async function api(path,body){const r=await fetch('/api/employee-credentials/'+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.message||'Temporary sign-in expired. Sign in again or ask HR to review your credentials.');e.code=d.code;throw e;}return d;}
 api('status').then(d=>{$('passwordSetupInfo').textContent=d.name+' · '+d.email+'. Choose your own password before opening the workspace.';form.hidden=false;}).catch(e=>{message.textContent=e.message;});
 form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;if($('personalPassword').value!==$('personalPasswordConfirm').value){message.textContent='Passwords must match.';return;}busy=true;submit.disabled=true;const password=$('personalPassword').value;$('personalPassword').value='';$('personalPasswordConfirm').value='';
  try{const d=await api('replace',{password,confirmed:$('personalPasswordConsent').checked});form.hidden=true;message.textContent=d.message;}catch(e){message.textContent=e.message;if(e.code!=='PASSWORD_REJECTED'&&!/Invalid request/.test(e.message))form.hidden=true;}finally{busy=false;submit.disabled=false;}
 };
 $('cancelPasswordSetup').onclick=async()=>{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(r.ok)location.assign('/login');else message.textContent='Sign-out failed. Retry.';};
})();
