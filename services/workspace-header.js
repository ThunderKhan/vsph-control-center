// CRM-style horizontal navigation; current permissions remain server-owned.
function workspaceHeader(user,escape,navigation=''){
 const name=escape(user.full_name||'Your account'),initials=escape(String(user.full_name||'VSPH').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase());
 const activeMark=user.status==='active'?'<span class="crm-avatar-status" title="Account active" role="img" aria-label="Account active"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8l2.6 2.6L12 5.2"/></svg></span>':'';
 return `<header class="workspace-topbar crm-topbar">
 <div class="crm-header-row">
  <div class="crm-brand-group"><button id="openMenu" class="icon-button top-menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="workspaceNavigation"><svg class="icon" aria-hidden="true"><use href="#icon-menu"></use></svg></button><a class="crm-brand" href="/dashboard" aria-label="VSPH home">VSPH<span>CONTROL CENTER</span></a></div>
  <form id="workspaceSearch" class="crm-global-search" role="search" action="/search"><label class="visually-hidden" for="workspaceSearchInput">Search authorized work</label><svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg><input id="workspaceSearchInput" type="search" minlength="2" maxlength="100" placeholder="Search work" autocomplete="off" aria-controls="workspaceSearchResults"><button type="submit" aria-label="Run workspace search">Search</button><section id="workspaceSearchResults" class="crm-search-results" aria-label="Workspace search results" hidden><p id="workspaceSearchStatus" role="status" aria-live="polite"></p><ul id="workspaceSearchItems"></ul><a href="/search">Advanced work search</a></section></form>
  <div class="crm-header-actions">
   <a class="crm-header-icon" href="/notifications" aria-label="Project notifications" title="Notifications"><svg class="icon" aria-hidden="true"><use href="#icon-bell"></use></svg></a>
    <a class="crm-header-icon" href="/applications" aria-label="Open application launcher" title="Applications"><svg class="icon" aria-hidden="true"><use href="#icon-apps"></use></svg></a>
   <details class="portal-disclosure portal-account"><summary aria-label="Account menu"><span class="crm-header-avatar-wrap"><span class="crm-header-avatar" id="avatar">${initials}</span>${activeMark}</span><span id="topAccount" class="crm-account-name">${name}</span><span class="portal-account-chevron" aria-hidden="true"></span></summary><div class="portal-dropdown"><div class="portal-account-info"><strong id="sideName">${name}</strong><small id="sideRole">${user.platform_role==='super_admin'?'Platform owner':'Workspace member'}</small></div><a class="portal-link" href="/account/profile" aria-label="Open account profile">Your profile</a><a class="portal-link" href="/account/security" aria-label="Account security and sessions">Security &amp; sessions</a><button id="logoutButton" type="button" class="portal-link portal-signout" aria-label="Sign out">Sign out</button></div></details>
  </div>
 </div>
 ${navigation}
 <div id="navigationFeedback" class="portal-nav-feedback" hidden><p id="navigationMessage" role="status" aria-live="polite"></p><button id="navigationRetry" type="button" hidden>Retry navigation access</button></div>
 </header>`;
}
module.exports={workspaceHeader};
