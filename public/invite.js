(()=>{'use strict';
const by=id=>document.getElementById(id),form=by('inviteForm'),error=by('inviteError'),success=by('inviteSuccess'),button=by('acceptButton');
const f=new URLSearchParams(location.hash.slice(1));
let token=f.get('invitation_token');const invitationId=f.get('invitation_id');
history.replaceState(null,'',location.pathname);
function report(m){error.textContent=m;error.hidden=!m;}
let newIdentity=true;
async function call(path,data){const r=await fetch('/api/invitations/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({invitationId,token,...data})});const body=await r.json();if(!r.ok)throw Error(body.message||'Invitation unavailable.');return body;}
if(!token||!invitationId){form.hidden=true;by('inviteInstructions').hidden=false;by('inviteInstructionsText').textContent='Request a current invitation from your administrator. Legacy account-wide invitation links are not accepted.';}
else call('inspect').then(info=>{newIdentity=info.newIdentity;button.disabled=false;if(!newIdentity){by('password').required=false;by('confirmPassword').required=false;for(const id of ['password','confirmPassword']){const label=document.querySelector('label[for='+id+']');if(label)label.hidden=true;}const link=document.createElement('a');link.href='/login';link.target='_blank';link.rel='noopener';link.textContent='Sign in to your existing account';form.prepend(link);by('password').hidden=true;by('confirmPassword').hidden=true;report('Existing account: sign into the portal in another tab, then accept here. Your password will not be changed.');}}).catch(e=>report(e.message));
form.addEventListener('submit',async e=>{e.preventDefault();if(!token)return;
 const password=by('password').value;if(newIdentity&&(password.length<12||password!==by('confirmPassword').value))return report('Use matching passwords of at least 12 characters.');
 button.disabled=true;try{await call('accept',newIdentity?{password}:{});token=null;form.hidden=true;success.hidden=false;by('password').value='';by('confirmPassword').value='';}catch(e){report(e.message);button.disabled=false;}
});})();
