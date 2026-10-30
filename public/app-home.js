const code=(location.pathname.split('/')[2]||'').toUpperCase();
const message=document.getElementById('recordMessage');
async function api(url,options={}){
 const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await r.json().catch(()=>({}));
 if(r.status===401){location.href=`/apps/${code.toLowerCase()}/login`;throw new Error('Application session required.')}
 if(!r.ok)throw new Error(data.message||'Request failed.');return data;
}
async function load(){
 try{
  const {application,organization,user,role}=await api(`/api/apps/${code}/context`);
  document.getElementById('appTitle').textContent=application.name;
  document.getElementById('userName').textContent=user.name;
  document.getElementById('tenantName').textContent=organization.name;
  document.getElementById('appRole').textContent=role.replaceAll('_',' ');
  document.getElementById('workspaceDescription').textContent='Application login verified. All records displayed below belong only to the selected customer organization.';
  if(code==='CRM'){
   document.getElementById('recordsHeading').textContent='CRM Contacts';
   document.getElementById('recordForm').innerHTML='<label for="fieldOne">Contact name</label><input id="fieldOne" required maxlength="150" placeholder="Contact name"><label for="fieldTwo">Email</label><input id="fieldTwo" type="email" maxlength="190" placeholder="contact@example.com"><label for="fieldThree">Company</label><input id="fieldThree" maxlength="150" placeholder="Company"><button>Add contact</button>';
  }else if(code==='MUSIC'){
   document.getElementById('recordsHeading').textContent='Music Requests';
   document.getElementById('recordForm').innerHTML='<label for="fieldOne">Song title</label><input id="fieldOne" required maxlength="150" placeholder="Song title"><label for="fieldTwo">Artist</label><input id="fieldTwo" maxlength="150" placeholder="Artist"><button>Add request</button>';
  }else{document.getElementById('recordsHeading').textContent='Module coming soon';document.getElementById('recordForm').hidden=true}
  if(role==='viewer'){document.getElementById('recordForm').hidden=true;message.textContent='View-only access.'}
  await loadRecords();
 }catch(err){message.textContent=err.message}
}
async function loadRecords(){
 const{records}=await api(`/api/apps/${code}/records`);
 const tbody=document.getElementById('recordRows');tbody.replaceChildren();
 if(!records.length){const tr=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=3;cell.textContent='No records yet.';tr.append(cell);tbody.append(tr)}
 for(const item of records){
  const tr=document.createElement('tr');
  const values=code==='CRM'?[item.name,item.email||'—',item.company||'—']:[item.song_title,item.artist||'—',item.status||'—'];
  for(const val of values){const td=document.createElement('td');td.textContent=val;tr.append(td)}tbody.append(tr);
 }
 document.getElementById('tableHead').replaceChildren(...(code==='CRM'?['Contact','Email','Company']:['Song','Artist','Status']).map(t=>{const th=document.createElement('th');th.textContent=t;return th}));
}
document.getElementById('recordForm').addEventListener('submit',async e=>{
 e.preventDefault();message.textContent='';
 const one=document.getElementById('fieldOne')?.value.trim(),two=document.getElementById('fieldTwo')?.value.trim(),three=document.getElementById('fieldThree')?.value.trim();
 const payload=code==='CRM'?{name:one,email:two,company:three}:{song_title:one,artist:two};
 try{await api(`/api/apps/${code}/records`,{method:'POST',body:JSON.stringify(payload)});e.target.reset();message.textContent='Record added.';await loadRecords()}catch(err){message.textContent=err.message}
});
document.getElementById('logoutButton').addEventListener('click',async()=>{
 await fetch('/api/auth/app-logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:code})});
 location.href='/dashboard.html';
});
load();
