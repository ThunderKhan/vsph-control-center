// Preserve the applications/overview first paint. Side-rail preferences no longer
// control layout: every authenticated page now uses horizontal top navigation.
document.documentElement.dataset.workspaceView=['/applications','/applications/'].includes(location.pathname)?'applications':'overview';
delete document.documentElement.dataset.sidebarState;
