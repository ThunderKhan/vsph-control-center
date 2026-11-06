(() => {
 'use strict';
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1)),id=params.get('enrollment_id'),token=params.get('token');
 // The capability never enters requests as a URL, storage, logs or referrers.
 history.replaceState(null,'',location.pathname);
 const message=$('enrollmentMessage'),form=$('enrollmentForm'),submit=$('enrollmentSubmit');let busy=false;
 async function api(action,extra={}){const r=await fetch('/api/employee-enrollment/'+action,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token,...extra})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.message||'Invitation unavailable. Ask VSPH to review or reissue it.');e.code=d.code;throw e;}return d;}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!form.reportValidity())return;if($('enrollmentPassword').value!==$('enrollmentConfirm').value){message.textContent='Passwords must match.';return;}
  const password=$('enrollmentPassword').value;$('enrollmentPassword').value='';$('enrollmentConfirm').value='';busy=true;submit.disabled=true;
  try{const d=await api('accept',{password,confirmed:$('enrollmentConsent').checked});form.hidden=true;message.textContent=d.message;}catch(e){if(e.code==='PASSWORD_REJECTED'){submit.disabled=false;message.textContent=e.message;return;}form.hidden=true;message.textContent=e.message+' If you already completed setup, try signing in. Otherwise ask the issuer to review the invitation.';}finally{busy=false;}
 });
 if(!id||!token){$('enrollmentInfo').textContent='Open the private invitation supplied by your HR manager or VSPH owner. Creating a staff record alone does not create a login.';return;}
 api('inspect').then(d=>{$('enrollmentInfo').textContent='Set up '+d.name+' ('+d.email+'). Invitation expires '+new Date(d.expiresAt).toLocaleString()+'.';form.hidden=false;}).catch(e=>{message.textContent=e.message;});
})();
