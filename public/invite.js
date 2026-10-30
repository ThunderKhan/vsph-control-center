(()=>{
'use strict';
const by=id=>document.getElementById(id);
const form=by('inviteForm'),button=by('acceptButton'),error=by('inviteError'),success=by('inviteSuccess');
const fragment=new URLSearchParams(location.hash.slice(1));
let token=fragment.get('access_token');
const errorDesc=fragment.get('error_description')||fragment.get('error');
history.replaceState(null,'',location.pathname);
function report(message){error.textContent=message;error.hidden=!message}
if(errorDesc || !token){
  // Direct visits from the login page are instructions-only. There is no
  // way to activate a tenant without the token supplied in the email.
  form.hidden=true;
  by('inviteInstructions').hidden=false;
  if(errorDesc)by('inviteInstructionsText').textContent=
    'Your invitation link is invalid or expired. Contact your VSPH administrator for a new invitation email.';
}else button.disabled=false;
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!token)return;
 const pass=by('password').value,confirm=by('confirmPassword').value;
 if(pass.length<12||pass.length>128)return report('Choose a password between 12 and 128 characters.');
 if(pass!==confirm)return report('The passwords do not match.');
 button.disabled=true;report('');
 try{
  const response=await fetch('/api/invitations/accept',{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({accessToken:token,password:pass})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.message||'Invitation could not be accepted.');
  token=null;form.hidden=true;success.hidden=false;
  by('password').value='';by('confirmPassword').value='';
 }catch(err){report(err.message||'Could not accept invitation.');button.disabled=false}
});
})();