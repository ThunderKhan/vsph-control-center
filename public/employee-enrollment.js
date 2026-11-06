(() => {
 'use strict';
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1)),id=params.get('enrollment_id'),token=params.get('token');
 // The capability never enters requests as a URL, storage, logs or referrers.
 history.replaceState(null,'',location.pathname);
 const message=$('enrollmentMessage'),form=$('enrollmentForm'),submit=$('enrollmentSubmit');let busy=false;

 const strengthFill=$('enrollmentStrengthFill'),strengthText=$('enrollmentStrengthText');
 function estimate(value){
  if(!value)return {level:0,description:'Strength appears as you type.'};
  const types=[/[a-z]/,/[A-Z]/,/[0-9]/,/[^a-zA-Z0-9]/].filter(p=>p.test(value)).length;
  const common=/password|qwerty|letmein|welcome|12345678|abcdefgh/i.test(value);
  const repetitions=/(.)\1{3,}/.test(value);
  const points=(value.length>=8?1:0)+(value.length>=12?1:0)+(value.length>=16?1:0)+(types>=3?1:0)+(types===4?1:0);
  const level=value.length<8||common||repetitions?1:Math.min(4,Math.max(1,points));
  const name=['','Weak','Fair','Good','Strong'][level];
  const advice=value.length<8?'Use at least 8 characters.':common||repetitions?'Avoid common or repeated patterns.':level<3?'Try a longer unique passphrase.':level<4?'Additional length helps.':'Use a different password for every account.';
  return {level,description:name+' (estimate). '+advice};
 }
 function updateStrength(){
  const {level,description}=estimate($('enrollmentPassword').value);
  strengthFill.style.width=25*level+'%';
  strengthFill.dataset.level=String(level);
  strengthText.textContent=description;
 }
 $('enrollmentPassword').addEventListener('input',updateStrength);
 for(const toggle of document.querySelectorAll('[data-password-target]')){
  toggle.addEventListener('click',()=>{
   const field=$(toggle.dataset.passwordTarget),visible=field.type==='password';
   field.type=visible?'text':'password';
   toggle.setAttribute('aria-pressed',String(visible));
   toggle.setAttribute('aria-label',(visible?'Hide ':'Show ')+(field.id==='enrollmentPassword'?'new':'confirmation')+' password');
   toggle.title=visible?'Hide password':'Show password';
   toggle.classList.toggle('is-visible',visible);
   field.focus();
  });
 }
 async function api(action,extra={}){const r=await fetch('/api/employee-enrollment/'+action,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token,...extra})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.message||'Invitation unavailable. Ask VSPH to review or reissue it.');e.code=d.code;throw e;}return d;}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!form.reportValidity())return;if($('enrollmentPassword').value!==$('enrollmentConfirm').value){message.textContent='Passwords must match.';return;}
  const password=$('enrollmentPassword').value;$('enrollmentPassword').value='';$('enrollmentConfirm').value='';updateStrength();busy=true;submit.disabled=true;
  try{const d=await api('accept',{password,confirmed:$('enrollmentConsent').checked});form.hidden=true;message.textContent=d.message;}catch(e){if(e.code==='PASSWORD_REJECTED'){submit.disabled=false;message.textContent=e.message;return;}form.hidden=true;message.textContent=e.message+' If you already completed setup, try signing in. Otherwise ask the issuer to review the invitation.';}finally{busy=false;}
 });
 if(!id||!token){$('enrollmentInfo').textContent='Open the private invitation supplied by your HR manager or VSPH owner. Creating a staff record alone does not create a login.';return;}
 api('inspect').then(d=>{$('enrollmentInfo').textContent='Set up '+d.name+' ('+d.email+'). Invitation expires '+new Date(d.expiresAt).toLocaleString()+'.';form.hidden=false;}).catch(e=>{message.textContent=e.message;});
})();
