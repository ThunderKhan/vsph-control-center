// CRM-style horizontal navigation; current permissions remain server-owned.
function workspaceHeader(user,escape,navigation=''){
 const name=escape(user.full_name||'Your account'),initials=escape(String(user.full_name||'VSPH').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase());
 return `<header class="workspace-topbar crm-topbar">
 <div class="crm-header-row">
  <div class="crm-brand-group"><button id="openMenu" class="icon-button top-menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="workspaceNavigation"><svg class="icon" aria-hidden="true"><use href="#icon-menu"></use></svg></button><a class="crm-brand" href="/dashboard" aria-label="VSPH home">VSPH<span>CONTROL CENTER</span></a></div>
  <form id="workspaceSearch" class="crm-global-search" role="search" action="/search"><label class="visually-hidden" for="workspaceSearchInput">Search authorized work</label><svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg><input id="workspaceSearchInput" type="search" minlength="2" maxlength="100" placeholder="Search work" autocomplete="off" aria-controls="workspaceSearchResults"><button type="submit" aria-label="Run workspace search">Search</button><section id="workspaceSearchResults" class="crm-search-results" aria-label="Workspace search results" hidden><p id="workspaceSearchStatus" role="status" aria-live="polite"></p><ul id="workspaceSearchItems"></ul><a href="/search">Advanced work search</a></section></form>
  <div class="crm-header-actions">
   <a class="crm-header-icon" href="/applications" aria-label="Open application launcher" title="Applications"><svg class="icon" aria-hidden="true"><use href="#icon-apps"></use></svg></a>
   <details class="portal-disclosure portal-account"><summary aria-label="Account menu"><span class="crm-header-avatar" id="avatar">${initials}</span><span id="topAccount" class="crm-account-name">${name}</span><span class="portal-account-chevron" aria-hidden="true"></span></summary><div class="portal-dropdown"><div class="portal-account-info"><strong id="sideName">${name}</strong><small id="sideRole">${user.platform_role==='super_admin'?'Platform owner':'Workspace member'}</small></div><a class="portal-link" href="/account/profile" aria-label="Open account profile">Your profile</a><button id="logoutButton" type="button" class="portal-link portal-signout" aria-label="Sign out">Sign out</button></div></details>
  </div>
 </div>
 ${navigation}
 <div id="navigationFeedback" class="portal-nav-feedback" hidden><p id="navigationMessage" role="status" aria-live="polite"></p><button id="navigationRetry" type="button" hidden>Retry navigation access</button></div>
 </header>`;
}
module.exports={workspaceHeader};
