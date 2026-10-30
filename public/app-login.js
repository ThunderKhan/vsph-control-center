const form=document.getElementById('appLoginForm');
const errorBox=document.getElementById('loginError');
const code=(location.pathname.split('/')[2]||'').toUpperCase();
let available=[];
async function initialize(){
 try{
  const r=await fetch(`/api/apps/${encodeURIComponent(code)}/contexts`);
  if(r.status===401){location.href='/login.html';return}
  const data=await r.json();if(!r.ok)throw new Error(data.message||'Application not available.');
  if(!data.organizations?.length)throw new Error('Your account is not assigned to this product.');
  available=data.organizations;
  document.getElementById('appTitle').textContent=data.application.name;
  document.getElementById('email').value=data.email;
  document.getElementById('email').readOnly=true;
  const select=document.getElementById('organizationId');
  for(const org of available){const opt=document.createElement('option');opt.value=org.id;opt.textContent=`${org.name} (${org.role.replaceAll('_',' ')})`;select.append(opt)}
 }catch(e){errorBox.textContent=e.message;form.querySelector('button').disabled=true}
}
form.addEventListener('submit',async e=>{
 e.preventDefault();errorBox.textContent='';const button=form.querySelector('button');button.disabled=true;button.textContent='Verifying access…';
 try{
  const r=await fetch('/api/auth/app-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   app:code,email:document.getElementById('email').value,password:document.getElementById('password').value,organizationId:document.getElementById('organizationId').value
  })});const data=await r.json();if(!r.ok)throw new Error(data.message||'Unable to sign in.');location.href=data.redirect;
 }catch(e){errorBox.textContent=e.message;button.disabled=false;button.textContent='Enter application'}
});
initialize();
