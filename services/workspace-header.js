// Layout adapted from hrithik41/CRM; identity and authorization stay server-owned.
function workspaceHeader(user,escape){
 const name=escape(user.full_name||'Your account'),initials=escape(String(user.full_name||'VSPH').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase());
 return `<header class="workspace-topbar crm-topbar">
 <div class="crm-header-row">
  <div class="mobile-brand"><button id="openMenu" class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="workspaceSidebar"><svg class="icon" aria-hidden="true"><use href="#icon-menu"></use></svg></button><span>VSPH</span></div>
  <div class="topbar-context">CONTROL CENTER</div>
  <form id="workspaceSearch" class="crm-global-search" role="search" action="/search"><label class="visually-hidden" for="workspaceSearchInput">Search authorized work</label><svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg><input id="workspaceSearchInput" type="search" minlength="2" maxlength="100" placeholder="Search work" autocomplete="off" aria-controls="workspaceSearchResults"><button type="submit" aria-label="Run workspace search">Search</button><section id="workspaceSearchResults" class="crm-search-results" aria-label="Workspace search results" hidden><p id="workspaceSearchStatus" role="status" aria-live="polite"></p><ul id="workspaceSearchItems"></ul><a href="/search">Advanced work search</a></section></form>
  <div class="crm-header-actions"><a class="crm-header-icon" href="/applications" aria-label="Open application launcher" title="Applications"><svg class="icon" aria-hidden="true"><use href="#icon-apps"></use></svg></a><a class="crm-header-avatar" href="/account/profile" aria-label="Open account profile" title="Your profile">${initials}</a></div>
 </div>
 <div class="crm-context-row"><span class="crm-workspace-label">VSPH workspace</span><span id="topAccount" class="topbar-account">${name}</span><a id="topbarOnboard" class="topbar-onboard" href="/admin/onboarding" aria-label="Create customer" ${user.platform_role==='super_admin'?'':'hidden'}>New customer</a></div>
 </header>`;
}
module.exports={workspaceHeader};
