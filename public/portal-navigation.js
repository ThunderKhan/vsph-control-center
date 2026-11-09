(() => {
 'use strict';
 const $=id=>document.getElementById(id),nav=$('workspaceNavigation');if(!nav)return;
 const header=nav.closest('header'),open=$('openMenu'),mobile=matchMedia('(max-width:950px)'),disclosures=[...header.querySelectorAll('.portal-disclosure')];
 const closeDetails=except=>{for(const d of disclosures)if(d!==except)d.open=false;};
 function close(restore=false){const wasOpen=document.body.classList.contains('nav-open');document.body.classList.remove('nav-open');open.setAttribute('aria-expanded','false');open.setAttribute('aria-label','Open navigation');closeDetails();if(restore&&wasOpen)open.focus();}
 open.addEventListener('click',()=>{if(!mobile.matches)return;if(document.body.classList.contains('nav-open')){close(true);return;}document.body.classList.add('nav-open');open.setAttribute('aria-expanded','true');open.setAttribute('aria-label','Close navigation');nav.querySelector('a').focus();});
 mobile.addEventListener('change',()=>close());
 for(const d of disclosures)d.addEventListener('toggle',()=>{if(d.open)closeDetails(d);});
 document.addEventListener('click',event=>{if(!header.contains(event.target))close();});
 header.addEventListener('focusout',event=>{if(event.relatedTarget&&!header.contains(event.relatedTarget))close();});
 header.addEventListener('keydown',event=>{
  if(event.key==='Escape'){const d=event.target.closest('.portal-disclosure[open]');if(d){d.open=false;d.querySelector('summary').focus();event.preventDefault();}else if(document.body.classList.contains('nav-open')){close(true);event.preventDefault();}return;}
  const d=event.target.closest('.portal-disclosure');if(!d)return;
  const links=[...d.querySelectorAll('a')].filter(a=>!a.closest('[hidden]'));
  if(!links.length)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();d.open=true;const index=links.indexOf(document.activeElement),step=event.key==='ArrowDown'?1:-1;links[index<0?(step>0?0:links.length-1):(index+step+links.length)%links.length].focus();}
  if(d.open&&(event.key==='Home'||event.key==='End')){event.preventDefault();links[event.key==='Home'?0:links.length-1].focus();}
 });
 header.addEventListener('click',event=>{if(!event.target.closest('.portal-disclosure'))closeDetails();if(event.target.closest('a'))close();});
 header.addEventListener('focusin',event=>{if(event.target.closest('#workspaceSearch'))close();});
 const current=location.pathname.replace(/\/$/,'')||'/dashboard',links=[...header.querySelectorAll('a.portal-link')];
 const active=links.filter(a=>current===a.pathname||current.startsWith(a.pathname+'/')).sort((a,b)=>b.pathname.length-a.pathname.length)[0];
 for(const a of links){a.classList.toggle('is-active',a===active);if(a===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 for(const d of disclosures)d.classList.toggle('has-active-page',Boolean(active&&d.contains(active)));
 const feedback=$('navigationFeedback'),message=$('navigationMessage'),retry=$('navigationRetry');
 async function access(){retry.hidden=true;feedback.hidden=true;try{const r=await fetch('/api/hrms/access',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});if(r.status===401){location.replace('/login');return;}if(!r.ok)throw Error('unavailable');const f=await r.json();$('employeeNavContainer').hidden=f.management!==true;$('hrGovernanceNav').hidden=f.governHr!==true;$('ownerManagerNav').hidden=f.governHr!==true;$('adminNavContainer').hidden=f.governHr!==true;$('orgAdminNav').hidden=f.governHr!==true;$('appAdminNav').hidden=f.governHr!==true;$('myWorkNav').hidden=f.employee!==true;
   const shortcut=$('myWorkShortcut');if(shortcut)shortcut.hidden=f.employee!==true;$('peopleNavigation').hidden=!(f.management===true||f.employee===true||f.pendingLink===true);for(const a of nav.querySelectorAll('[data-nav="employment"]'))a.hidden=!(f.employee===true||f.pendingLink===true);document.documentElement.dataset.navigationReady='true';}catch{const shortcut=$('myWorkShortcut');if(shortcut)shortcut.hidden=true;message.textContent='Some navigation permissions could not be checked.';retry.hidden=false;feedback.hidden=false;}}
 retry.addEventListener('click',access);void access();
 $('logoutButton').addEventListener('click',async()=>{const button=$('logoutButton');button.disabled=true;try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('Sign out failed. Please retry.');location.replace('/login');}catch(e){message.textContent=e.message;feedback.hidden=false;button.disabled=false;}});
})();
