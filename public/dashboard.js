(() => {
  'use strict';

  // Product cards are derived from the server's authorized application list.
  // Nothing is displayed as "live" telemetry or inferred from demo fixtures.
  const productPresentation = {
    CRM: {
      category: 'CUSTOMER MANAGEMENT',
      description: 'Customer contacts and relationship management.',
      icon: 'icon-crm'
    },
    MUSIC: {
      category: 'VENUE OPERATIONS',
      description: 'Music requests and guest-facing experiences.',
      icon: 'icon-music'
    }
  };

  const byId = id => document.getElementById(id);
  const grid = byId('appGrid');
  const accessGrid = byId('accessGrid');
  const isApplicationsView = /^\/applications\/?$/.test(window.location.pathname);
  const search = byId('appSearch');
  const error = byId('errorMessage');
  const empty = byId('emptyMessage');
  const logout = byId('logoutButton');
  let authorizedApps = [];
  let loaded = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(symbol) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + symbol);
    svg.append(use);
    return svg;
  }

  function showError(text) {
    error.textContent = text || '';
    error.hidden = !text;
  }

  function appCard(app) {
    const code = String(app.code || '').toUpperCase();
    const details = productPresentation[code] || {
      category: 'BUSINESS APPLICATION',
      description: 'Your assigned business workspace.',
      icon: 'icon-generic'
    };
    const card = element('article', 'app-card');
    const top = element('div', 'app-card-upper');
    const mark = element('span', 'app-symbol');
    mark.append(icon(details.icon));
    const status = element('span', 'app-status', 'Available');
    top.append(mark, status);

    const category = element('p', 'app-category', details.category);
    const heading = element('h3', '', app.name || code);
    const description = element('p', 'app-description', details.description);
    const link = element('a', 'app-open', 'Open application');

    // Never trust a product's database-provided URL as an arbitrary destination.
    // Construct a same-origin application route from a validated product code.
    link.href = '/apps/' + code.toLowerCase() + '/login';
    link.setAttribute('aria-label', 'Open ' + (app.name || code));
    card.append(top, category, heading, description, link);
    addSpotlight(card);
    return card;
  }

  function renderApps() {
    if (!loaded || !isApplicationsView) return;
    const term = search.value.trim().toLocaleLowerCase();
    const matches = authorizedApps.filter(app =>
      (String(app.name || '') + ' ' + String(app.code || '')).toLocaleLowerCase().includes(term)
    );

    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'false');
    byId('libraryCount').textContent = matches.length + (matches.length === 1 ? ' product' : ' products');
    empty.hidden = matches.length > 0;
    empty.textContent = authorizedApps.length === 0
      ? 'No applications have been assigned to your account yet.'
      : 'No applications match your search.';

    for (const app of matches) grid.append(appCard(app));
  }

  function accessRow(app, contexts, failed = false) {
    const code = String(app.code).toUpperCase();
    const item = element('article', 'access-row');
    const identity = element('div', 'access-row-product');
    const name = element('strong', '', app.name || code);
    const status = element('span', 'access-row-caption',
      failed ? 'Unable to retrieve product access' :
      (contexts.length === 1 ? '1 customer workspace' : contexts.length + ' customer workspaces'));
    identity.append(name, status);

    const detail = element('div', 'access-row-details');
    if (!failed && contexts.length) {
      const roles = [...new Set(contexts.map(org => String(org.role || 'user').replaceAll('_',' ')))];
      detail.append(element('strong', 'access-role-label', roles.join(', ')));
      const names = contexts.slice(0, 3).map(org => String(org.name || 'Customer')).join(' · ');
      detail.append(element('span', 'access-org-label', names + (contexts.length > 3 ? ' · +' + (contexts.length - 3) + ' more' : '')));
    } else {
      detail.append(element('span', 'access-org-label',
        failed ? 'Product access details are temporarily unavailable.' : 'No active customer assignments'));
    }

    const open = element('a', 'access-open', 'Open');
    open.href = '/apps/' + code.toLowerCase() + '/login';
    open.setAttribute('aria-label', 'Open ' + (app.name || code));
    item.append(identity, detail, open);
    return item;
  }

  async function renderAccessOverview() {
    const tasks = authorizedApps.map(async app => {
      try {
        const result = await responseJson('/api/apps/' + encodeURIComponent(app.code) + '/contexts');
        if (!result) return {app, contexts:[], failed:true};
        return {app, contexts:Array.isArray(result.organizations) ? result.organizations : [], failed:false};
      } catch {
        return {app, contexts:[], failed:true};
      }
    });
    const results = await Promise.all(tasks);
    accessGrid.replaceChildren();
    accessGrid.setAttribute('aria-busy', 'false');
    if (!results.length) {
      accessGrid.append(element('p','access-empty','No products are currently assigned to your account.'));
      return;
    }
    for (const item of results) accessGrid.append(accessRow(item.app,item.contexts,item.failed));
  }

  function addSpotlight(surface) {
    if (!surface || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    surface.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const bounds = surface.getBoundingClientRect();
      surface.style.setProperty('--pointer-x', (event.clientX - bounds.left) + 'px');
      surface.style.setProperty('--pointer-y', (event.clientY - bounds.top) + 'px');
    }, { passive: true });
  }

  function closeNavigation(restoreFocus = false) {
    document.body.classList.remove('nav-open');
    byId('navBackdrop').hidden = true;
    byId('openMenu').setAttribute('aria-expanded', 'false');
    if (restoreFocus) byId('openMenu').focus();
  }

  function openNavigation() {
    document.body.classList.add('nav-open');
    byId('navBackdrop').hidden = false;
    byId('openMenu').setAttribute('aria-expanded', 'true');
    byId('closeMenu').focus();
  }

  function setupMobileNavigation() {
    byId('openMenu').addEventListener('click', openNavigation);
    byId('closeMenu').addEventListener('click', () => closeNavigation(true));
    byId('navBackdrop').addEventListener('click', () => closeNavigation(true));
    byId('workspaceSidebar').addEventListener('click', event => {
      if (event.target.closest('a') && window.innerWidth <= 950) closeNavigation();
    });
    document.addEventListener('keydown', event => {
      if (!document.body.classList.contains('nav-open')) return;
      if (event.key === 'Escape') {
        closeNavigation(true);
      } else if (event.key === 'Tab') {
        const focusable = [...byId('workspaceSidebar').querySelectorAll('a, button:not([disabled])')].filter(node => !node.hidden && node.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 950) closeNavigation();
    });

    for (const link of document.querySelectorAll('.sidebar-link')) {
      const href = link.getAttribute('href');
      const active = href === (isApplicationsView ? '/applications' : '/dashboard');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  async function responseJson(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (response.status === 401) {
      window.location.replace('/login');
      return null;
    }
    if (!response.ok) throw new Error('Could not load workspace details. Please refresh and try again.');
    return response.json();
  }

  async function loadDashboard() {
    try {
      const identity = await responseJson('/api/auth/me');
      if (!identity) return;
      const user = identity.user;
      if (!user) throw new Error('Your account details are unavailable. Please refresh.');

      const name = String(user.name || 'Account').trim();
      const firstName = name.split(/\s+/)[0];
      byId('sideName').textContent = name;
      byId('sideRole').textContent = user.platformRole === 'super_admin' ? 'Platform administrator' : 'Workspace member';
      byId('avatar').textContent = firstName.charAt(0).toUpperCase() || 'V';
      byId('topAccount').textContent = name;
      byId('welcomeMessage').textContent = 'Welcome back, ' + firstName + '. Your applications are ready when you are.';
      byId('adminNavContainer').hidden = user.platformRole !== 'super_admin';
      byId('adminOverviewPanel').hidden = user.platformRole !== 'super_admin';

      const result = await responseJson('/api/apps');
      if (!result) return;
      authorizedApps = (Array.isArray(result.applications) ? result.applications : [])
        .filter(app => /^[A-Z][A-Z0-9_]{1,39}$/i.test(String(app.code || '')) && app.status === 'active');

      const count = String(authorizedApps.length);
      byId('appCount').textContent = count;
      byId('featureAppCount').textContent = count;

      const workspaces = await responseJson('/api/workspaces').catch(() => null);
      if (workspaces) {
        const number = Number(workspaces.count);
        byId('workspaceCount').textContent = Number.isSafeInteger(number) && number >= 0 ? String(number) : '—';
      }

      loaded = true;
      if (isApplicationsView) renderApps();
      else await renderAccessOverview();
    } catch (failure) {
      if (isApplicationsView) {
        grid.replaceChildren();
        grid.setAttribute('aria-busy', 'false');
      } else {
        accessGrid.replaceChildren();
        accessGrid.setAttribute('aria-busy', 'false');
      }
      loaded = true;
      empty.hidden = true;
      showError(failure.message || 'The workspace could not be loaded.');
    }
  }

  function setupLogout() {
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      showError('');
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('Could not sign out. Please try again.');
        window.location.replace('/login');
      } catch (failure) {
        showError(failure.message || 'Could not sign out. Please try again.');
        logout.disabled = false;
      }
    });
  }

  // A shared page shell, two different route-specific views.
  document.title = (isApplicationsView ? 'Applications' : 'Overview') + ' | VSPH Control Center';
  for (const section of document.querySelectorAll('[data-view]')) {
    section.hidden = section.getAttribute('data-view') !== (isApplicationsView ? 'applications' : 'overview');
  }
  setupMobileNavigation();
  setupLogout();
  addSpotlight(byId('spotlightPanel'));
  search.addEventListener('input', renderApps);
  loadDashboard();
})();
