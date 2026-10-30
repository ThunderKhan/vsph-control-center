const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function harness(pathname) {
  class Element {
    constructor(id = '') {
      this.id = id;
      this.hidden = false;
      this.disabled = false;
      this.required = false;
      this.readOnly = false;
      this.value = '';
      this.type = id === 'password' ? 'password' : 'text';
      this.placeholder = '';
      this.textContent = '';
      this.attributes = {};
      this.handlers = {};
      this.children = [];
      this.style = { setProperty: (key, value) => { this.styles[key] = value; } };
      this.styles = {};
      this.classList = { add: value => { this.classes.push(value); } };
      this.classes = [];
    }
    addEventListener(type, callback) { this.handlers[type] = callback; }
    fire(type, event = {}) { return this.handlers[type]?.(event); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    querySelector(selector) { return elements[selector]; }
    replaceChildren() { this.children = []; this.value = ''; }
    append(child) {
      this.children.push(child);
      if (this.children.length === 1) this.value = child.value;
    }
  }
  const elements = {};
  for (const id of [
    'authForm', 'email', 'password', 'organizationField', 'organizationId',
    'authSubmit', 'authError', 'backLink', 'heroKicker', 'heroLineOne',
    'heroLineTwo', 'heroDescription', 'cardKicker', 'authHeading', 'formDescription'
  ]) elements[id] = new Element(id);
  elements['.submit-label'] = new Element();
  elements['[data-password-toggle="password"]'] = new Element();
  elements['[data-icon="show"]'] = new Element();
  elements['[data-icon="hide"]'] = new Element();
  elements['[data-password-toggle="password"]'].querySelector = key => elements[key];
  elements.authSubmit.querySelector = key => elements[key];

  const location = {
    pathname, assigned: null, replaced: null,
    assign(url) { this.assigned = url; },
    replace(url) { this.replaced = url; }
  };
  const calls = [];
  let contexts = {
    application: { code: 'CRM', name: 'Customer Relationship Management' },
    email: 'crm@vsph.test',
    organizations: [{ id: 'tenant-1', name: 'Alpha CRM', role: 'admin' }]
  };
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/contexts')) return { ok: true, status: 200, json: async () => contexts };
    if (url === '/api/auth/app-login') return { ok: true, status: 200, json: async () => ({ redirect: '/apps/crm/home' }) };
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ message: 'Signed in' }) };
    throw new Error('Unexpected endpoint ' + url);
  };
  const document = {
    title: '',
    body: elements.body = new Element('body'),
    getElementById: id => elements[id],
    querySelector: selector => elements[selector],
    createElement: () => new Element('option')
  };
  const window = { location, VSPH_AUTH_CONFIG: null };
  const context = vm.createContext({ window, document, fetch, console });
  vm.runInContext(read('public/auth-config.js'), context);
  vm.runInContext(read('public/auth-page.js'), context);
  return { elements, location, calls, setContexts: data => { contexts = data; } };
}

test('portal login uses shared form, password-eye and portal endpoint', async () => {
  const h = harness('/login');
  assert.equal(h.elements.organizationField.hidden, true);
  assert.equal(h.elements.authSubmit.disabled, false);
  assert.equal(h.elements.heroLineOne.textContent, 'Building');
  h.elements.email.value = 'owner@vsph.test';
  h.elements.password.value = 'private password';
  h.elements['[data-password-toggle="password"]'].fire('click');
  assert.equal(h.elements.password.type, 'text');
  assert.equal(h.elements['[data-password-toggle="password"]'].attributes['aria-label'], 'Hide password');
  await h.elements.authForm.fire('submit', { preventDefault() {} });
  const request = h.calls.find(call => call.url === '/api/auth/login');
  assert.ok(request);
  assert.equal(JSON.parse(request.options.body).email, 'owner@vsph.test');
  assert.equal(h.location.assigned, '/dashboard.html');
});

test('CRM app login requires authorized contexts and separate second login', async () => {
  const h = harness('/apps/crm/login');
  assert.equal(h.elements.organizationField.hidden, false);
  assert.equal(h.elements.organizationId.required, true);
  assert.equal(h.elements.email.readOnly, true);
  assert.equal(h.elements.authSubmit.disabled, true);
  // Flush controller initialization after its context fetch resolves.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.elements.authSubmit.disabled, false);
  assert.equal(h.elements.organizationId.value, 'tenant-1');
  assert.equal(h.elements.email.value, 'crm@vsph.test');
  h.elements.password.value = 'private password';
  await h.elements.authForm.fire('submit', { preventDefault() {} });
  const request = h.calls.find(call => call.url === '/api/auth/app-login');
  assert.ok(request);
  const payload = JSON.parse(request.options.body);
  assert.deepEqual({ app: payload.app, email: payload.email, organizationId: payload.organizationId }, {
    app: 'CRM', email: 'crm@vsph.test', organizationId: 'tenant-1'
  });
  assert.equal(h.location.assigned, '/apps/crm/home');
  assert.ok(!h.calls.some(call => call.url === '/api/auth/login'));
});

test('Music app uses the same component and selected app code', async () => {
  const h = harness('/apps/music/login');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.elements.organizationField.hidden, false);
  h.elements.password.value = 'private password';
  await h.elements.authForm.fire('submit', { preventDefault() {} });
  const request = h.calls.find(call => call.url === '/api/auth/app-login');
  assert.equal(JSON.parse(request.options.body).app, 'MUSIC');
});
