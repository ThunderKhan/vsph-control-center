(() => {
 'use strict';
 const form=document.getElementById('workspaceSearch');if(!form)return;
 const input=document.getElementById('workspaceSearchInput'),panel=document.getElementById('workspaceSearchResults'),status=document.getElementById('workspaceSearchStatus'),items=document.getElementById('workspaceSearchItems');
 let controller,version=0;
 const close=()=>{controller?.abort();version++;panel.hidden=true;items.replaceChildren();status.textContent='';};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!input.reportValidity()||input.value.trim().length<2){input.focus();return;}
  controller?.abort();controller=new AbortController();const current=++version;panel.hidden=false;items.replaceChildren();status.textContent='Searching authorized work…';
  try{
   const response=await fetch('/api/search?'+new URLSearchParams({q:input.value.trim(),kind:'all'}),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
   if(response.status===401){location.assign('/login');return;}
   const data=await response.json();if(current!==version)return;if(!response.ok)throw Error('Search is temporarily unavailable. Try advanced search.');
   for(const row of (data.results||[]).slice(0,10)){
    if(!/^[a-f0-9-]{36}$/i.test(row.project_id))continue;
    const item=document.createElement('li'),link=document.createElement('a'),label=document.createElement('small');link.href='/projects/'+encodeURIComponent(row.project_id);link.textContent=row.title;label.textContent=row.kind+' · '+row.project_name;link.append(label);item.append(link);items.append(item);
   }
   status.textContent=items.childElementCount?'Showing up to 10 authorized matches.':'No authorized matching work found.';
  }catch(e){if(current===version&&e.name!=='AbortError'){items.replaceChildren();status.textContent='Search is temporarily unavailable. Try advanced search.';}}
 });
 input.addEventListener('input',close);document.addEventListener('click',event=>{if(!form.contains(event.target))close();});
 form.addEventListener('keydown',event=>{if(event.key==='Escape'){close();input.focus();}});
 // Search terms remain in this page's memory, never in storage or navigation URLs.
})();
