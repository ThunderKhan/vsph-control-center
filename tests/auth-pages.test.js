const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const view = () => read('views/auth.html');
const controller = () => read('public/auth-page.js');

test('portal and every product use a single, non-public login template', () => {
  const html = view();
  const server = read('server.js');
  assert.ok(html.includes('id="authForm"'));
  assert.ok(html.includes('id="email"'));
  assert.ok(html.includes('id="password"'));
  assert.ok(html.includes('id="organizationField"'));
  assert.ok(html.includes('id="organizationId"'));
  assert.ok(html.includes('id="authSubmit"'));
  assert.ok(html.includes('src="/auth-page.js"'));
  assert.ok(html.includes('src="/auth-config.js"'));
  assert.ok(html.includes('src="/auth-background.js"'));
  assert.ok(server.includes("path.join(__dirname,'views','auth.html')"));
  assert.ok(server.includes("res.sendFile(authViews[application.code] || sharedAuthView)"));
  assert.ok(server.includes("app.get(['/', '/login'],(req,res)=>res.sendFile(sharedAuthView))"));
  for (const obsolete of ['public/login.html', 'public/app-login.html', 'public/app.js', 'public/app-login.js']) {
    assert.equal(fs.existsSync(path.join(root, obsolete)), false, obsolete + ' should not be duplicated');
  }
});

test('product login remains server-protected and app sessions stay separate', () => {
  const server = read('server.js');
  const js = controller();
  assert.ok(server.includes("app.get('/apps/:app/login',portalSession"));
  assert.ok(server.includes("getContexts(req.user,application)"));
  assert.ok(server.includes("if(!contexts.length)return res.status(403)"));
  assert.ok(js.includes("'/api/auth/login'"));
  assert.ok(js.includes("'/api/auth/app-login'"));
  assert.ok(js.includes('organizationId: organizationSelect.value'));
  assert.ok(js.includes("window.location.assign(data.redirect)"));
  assert.ok(js.includes("window.location.assign('/dashboard.html')"));
  assert.ok(js.includes("response.status === 401"));
  assert.ok(js.includes("window.location.replace('/login')"));
});

test('product-specific organization selector only appears for app login', () => {
  const html = view();
  const js = controller();
  assert.ok(html.includes('id="organizationField" class="organization-field" hidden'));
  assert.ok(html.includes('<select id="organizationId" name="organizationId" disabled>'));
  assert.ok(js.includes('organizationField.hidden = false'));
  assert.ok(js.includes('organizationSelect.required = true'));
  assert.ok(js.includes('organizationSelect.disabled = true'));
  assert.ok(js.includes('organizationSelect.disabled = false'));
  assert.ok(js.includes('email.readOnly = true'));
  assert.ok(js.includes('const appCode = match ? match[1].toUpperCase() : null'));
});

test('all login pages inherit the approved VSPH design', () => {
  const html = view(), css = read('public/auth.css'), design = read('DESIGN.md');
  assert.ok(html.includes("What's Next"));
  assert.ok(html.includes('ENTERPRISE SOFTWARE'));
  assert.ok(html.includes('Enterprise Software Solutions for a Smarter Tomorrow.'));
  assert.ok(html.includes('© 2026 VSPH. All rights reserved.'));
  assert.ok(css.includes('font-family:Inter,Arial,sans-serif'));
  assert.ok(css.includes('--navy:#00255A'));
  assert.ok(css.includes('--blue:#0069C8'));
  assert.ok(design.includes('#00255A') && design.includes('#0069C8'));
});

test('login screens do not repeat removed decorative elements', () => {
  const html = view();
  for (const unwanted of [
    'SECURE WORKSPACE', 'People | Products | Possibilities',
    'pixel-progress', 'intro-rule', 'card-arrow',
    'Access is managed by your organization.', 'Sign in to workspace',
    'Continue with Google', 'Continue with GitHub', 'Continue with Apple', 'Sign Up'
  ]) assert.ok(!html.includes(unwanted), unwanted);
  assert.ok(html.includes('<div class="card-kicker" id="cardKicker">VSPH CONTROL CENTER</div>'));
  assert.ok(html.includes('<span class="submit-label">Sign in</span></button>'));
});

test('password toggle uses a single accessible eye and eye-off component', () => {
  const html = view(), js = controller(), css = read('public/auth.css');
  assert.equal((html.match(/data-password-toggle="password"/g) || []).length, 1);
  assert.ok(html.includes('aria-label="Show password"'));
  assert.ok(html.includes('aria-pressed="false"'));
  assert.ok(html.includes('data-icon="show"'));
  assert.ok(html.includes('data-icon="hide"'));
  assert.ok(html.includes('data-icon="hide"') && html.includes('aria-hidden="true" hidden'));
  assert.ok(js.includes("toggle.querySelector('[data-icon=\"show\"]').hidden = reveal"));
  assert.ok(js.includes("toggle.querySelector('[data-icon=\"hide\"]').hidden = !reveal"));
  assert.ok(css.includes('.reveal svg[hidden]{display:none}'));
});

test('submit buttons stay centered and loading labels reset to Sign in', () => {
  const html = view(), js = controller(), css = read('public/auth.css');
  assert.ok(html.includes('id="authSubmit"'));
  assert.ok(css.includes('align-items:center;justify-content:center;text-align:center'));
  assert.ok(js.includes("buttonLabel.textContent = busy ? loadingText : 'Sign in'"));
});

test('desktop fits the viewport while short and mobile layouts can scroll', () => {
  const css = read('public/auth.css');
  assert.ok(css.includes('@media (min-width:901px) and (min-height:760px)'));
  assert.ok(css.includes('body.auth-page{overflow:hidden}'));
  assert.ok(css.includes('height:100dvh'));
  assert.ok(css.includes('@media (min-width:901px) and (max-height:759px)'));
  assert.ok(css.includes('@media(max-width:900px)'));
  assert.ok(css.includes('@media(max-width:540px)'));
  assert.ok(css.includes('.app-auth .auth-card'));
});

test('brand variants can override product or authorized customer without copying the page', () => {
  const context = { window: {} };
  vm.runInNewContext(read('public/auth-config.js'), context);
  const cfg = context.window.VSPH_AUTH_CONFIG;
  assert.equal(cfg.base.heroKicker, 'ENTERPRISE SOFTWARE');
  assert.equal(cfg.base.action, '#0069C8');
  assert.equal(cfg.base.layout, 'split');
  assert.ok(cfg.apps && typeof cfg.apps === 'object');
  assert.ok(cfg.organizations && typeof cfg.organizations === 'object');
  const js = controller();
  assert.ok(js.includes("(config.apps || {})[appCode]"));
  assert.ok(js.includes("(config.organizations || {})[organizationKey]"));
  assert.ok(js.includes("Object.assign({}, config.base || {}, product, customer)"));
  assert.ok(js.includes("organizationSelect.addEventListener('change', appearance)"));
});

test('login redirects remain extension-free and old login URLs are compatible', () => {
  const server = read('server.js');
  const js = controller();
  assert.ok(server.includes("app.get('/login.html',(req,res)=>res.redirect(302,'/login'))"));
  assert.ok(server.indexOf("app.get('/login.html'") < server.indexOf('app.use(express.static'));
  assert.ok(js.includes("window.location.replace('/login')"));
  assert.ok(read('public/dashboard.js').includes('"/login"'));
});

test('the shared login view and source are valid JavaScript syntax', () => {
  assert.doesNotThrow(() => new Function(controller()));
  assert.doesNotThrow(() => new Function(read('public/auth-config.js')));
});
