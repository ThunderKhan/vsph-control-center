(() => {
 'use strict';
 const form=document.getElementById('searchForm'),results=document.getElementById('searchResults'),message=document.getElementById('searchMessage'),next=document.getElementById('nextPage'),first=document.getElementById('firstPage');
 let committed=null,nextCursor=null,requestNumber=0,controller;
 const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const fields=['q','kind','status','projectId','organizationId','assigneeId','from','to'];
 function resetResults(){results.replaceChildren();next.hidden=true;first.hidden=true;nextCursor=null;}
 async function search(after=null,newQuery=null){
  if(newQuery)committed=newQuery;
  if(!committed)return;
  controller?.abort();controller=new AbortController();const number=++requestNumber;
  resetResults();message.textContent='Searching current project work…';results.setAttribute('aria-busy','true');
  next.disabled=true;first.disabled=true;
  const params=new URLSearchParams(committed);if(after)params.set('after',after);
  // Search text is held in memory; no URL/history/localStorage persistence or analytics.
  try{
   const r=await fetch('/api/search?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const data=await r.json().catch(()=>({}));if(number!==requestNumber)return;
   if(r.status===401){location.assign('/login');return;}
   if(!r.ok)throw Error(data.message||'Search is unavailable. Retry after the dependency recovers.');
   const list=node('ol','');list.className='search-list';
   for(const item of data.results){
    const row=node('li',''),article=node('article',''),heading=node('h2',''),link=node('a',item.title);
    // Links use only UUIDs from the authorized RPC; text is never interpreted as HTML.
    link.href='/projects/'+encodeURIComponent(item.project_id);heading.append(link);
    article.append(node('p',item.kind.toUpperCase()+' · '+item.project_key),heading,node('p',item.project_name+' · '+item.status.replaceAll('_',' ')+' · Due '+(item.due_on||'not set')));row.append(article);list.append(row);
   }
   results.append(list);nextCursor=data.nextCursor;next.hidden=!nextCursor;first.hidden=!after;
   message.textContent=data.results.length?data.results.length+' matches on this page'+(nextCursor?'; more results are available.':'.'):'No authorized matching work found.';
   results.focus();
  }catch(e){if(e.name!=='AbortError'&&number===requestNumber){resetResults();message.textContent=e.message;}}
  finally{if(number===requestNumber){results.setAttribute('aria-busy','false');next.disabled=false;first.disabled=false;}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();const q={};for(const key of fields){const value=form.elements.namedItem(key).value.trim();if(value)q[key]=value;}search(null,q);});
 // Any filter edit invalidates pagination, so a stale cursor can never be used with new filters.
 form.addEventListener('input',()=>{controller?.abort();requestNumber++;resetResults();committed=null;results.setAttribute('aria-busy','false');message.textContent='Filters changed. Search again to see current results.';});
 form.addEventListener('reset',()=>{controller?.abort();requestNumber++;committed=null;resetResults();results.setAttribute('aria-busy','false');message.textContent='No search has been run.';});
 next.addEventListener('click',()=>search(nextCursor));first.addEventListener('click',()=>search());
})();
