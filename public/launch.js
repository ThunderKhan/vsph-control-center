(()=>{
'use strict';
const select=document.getElementById('organization');
const button=document.getElementById('launchButton');
const form=document.getElementById('launchForm');
const error=document.getElementById('error');
const role=document.getElementById('roleDescription');
let startUrl=null;
function fail(message){error.textContent=message;error.hidden=false;button.disabled=true;}
async function init(){
  try{
    const response=await fetch('/api/sso/config/MUSIC',{credentials:'same-origin',cache:'no-store'});
    if(response.status===401){window.location.replace('/login');return;}
    const data=await response.json();
    if(!response.ok || !data.enabled || !data.startUrl)throw Error(data.message||'External Music integration is not available.');
    const url=new URL(data.startUrl,window.location.origin);
    if(url.origin===window.location.origin || !['https:','http:'].includes(url.protocol) ||
       (url.protocol!=='https:' && !['localhost','127.0.0.1'].includes(url.hostname)))
      throw Error('Music launch configuration is invalid.');
    startUrl=url;
    select.replaceChildren();
    for(const org of data.organizations||[]){
      const option=document.createElement('option');
      option.value=org.id;
      option.textContent=org.name+' ('+String(org.role||'user').replaceAll('_',' ')+')';
      select.append(option);
    }
    if(!select.options.length)throw Error('No eligible customer organizations.');
    select.disabled=false;button.disabled=false;
    role.textContent='Your product role will be verified after authorization.';
  }catch(e){fail(e.message||'Could not load Music workspaces.');}
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(button.disabled||!startUrl||!select.value)return;
  button.disabled=true;
  const dest=new URL(startUrl.toString());
  dest.searchParams.set('organization_id',select.value);
  // The Music BACKEND creates state + PKCE before contacting VSPH.
  window.location.assign(dest.toString());
});
init();
})();
