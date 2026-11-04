// Parser-blocking same-origin script: restore layout before body paint without
// expanding CSP to allow arbitrary inline code.
try { document.documentElement.dataset.sidebarState=localStorage.getItem('vsph.sidebar.collapsed')==='true'?'collapsed':'expanded'; }
catch { document.documentElement.dataset.sidebarState='expanded'; }
