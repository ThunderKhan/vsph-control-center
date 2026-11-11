(() => {
'use strict';
const el=id=>document.getElementById(id);
const msg=(text,error=false)=>{el('message').textContent=text;el('message').className=error?'message error':'message';};
async function api(path,options={}){
  const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,
    headers:{'Content-Type':'application/json',...(options.headers||{})}});
  if(res.status===401){location.assign('/login');throw new Error('Session expired.');}
  if(res.status===403)throw new Error('Owner authorization required.');
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||'Request unavailable.');
  return data;
}
let users=[],grants=[];
const labelRole=value=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function option(value,label){
  const element=document.createElement('option');element.value=value;element.textContent=label;
  return element;
}
async function refresh(){
  const [staff,access]=await Promise.all([
    api('/api/admin-management/users'),
    api('/api/admin-management/outreach-access')
  ]);
  users=(staff.users||[]).filter(u=>u.status==='active');
  grants=access.items||[];
  const chosen=el('employee').value;el('employee').replaceChildren(option('','Select account'));
  for(const u of users)el('employee').append(option(u.id,u.full_name+' · '+u.email));
  if(users.some(u=>u.id===chosen))el('employee').value=chosen;
  const body=el('grants');body.replaceChildren();
  if(!grants.length){
    const tr=document.createElement('tr'),td=document.createElement('td');
    td.colSpan=4;td.textContent='No Outreach access granted.';tr.append(td);body.append(tr);return;
  }
  for(const g of grants){
    const tr=document.createElement('tr'),employee=document.createElement('td'),
      name=document.createElement('strong'),email=document.createElement('span'),
      role=document.createElement('td'),status=document.createElement('td'),
      action=document.createElement('td');
    name.textContent=g.full_name||g.user_id;email.textContent=g.email||'';
    employee.append(name,email);role.textContent=labelRole(g.role_code);
    status.textContent=labelRole(g.status);
    if(g.status==='enabled'){
      const revoke=document.createElement('button');revoke.type='button';revoke.className='revoke';
      revoke.textContent='Revoke';revoke.addEventListener('click',async()=>{
        if(!confirm('Revoke Outreach access for '+(g.full_name||g.email)+'?'))return;
        revoke.disabled=true;
        try{await api('/api/admin-management/outreach-access/'+encodeURIComponent(g.user_id),
          {method:'DELETE'});msg('Outreach access revoked.');await refresh();}
        catch(error){msg(error.message,true);revoke.disabled=false;}
      });action.append(revoke);
    }else action.textContent='—';
    tr.append(employee,role,status,action);body.append(tr);
  }
}
el('grantForm').addEventListener('submit',async(event)=>{
  event.preventDefault();const user=el('employee').value,role=el('role').value;
  if(!user)return;
  const btn=el('grant');btn.disabled=true;
  try{
    await api('/api/admin-management/outreach-access/'+encodeURIComponent(user),{
      method:'PUT',body:JSON.stringify({role})});
    msg('Access granted.');await refresh();
  }catch(e){msg(e.message,true);}
  finally{btn.disabled=false;}
});
el('refresh').addEventListener('click',()=>{void refresh().catch(e=>msg(e.message,true));});
void refresh().catch(e=>msg(e.message,true));
})();
