const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const page = name => fs.readFileSync(path.join(root, 'public', name), 'utf8');

test('portal form retains the existing backend contract', () => {
  const html = page('login.html');
  for(const id of ['loginForm','email','password','message']) assert.ok(html.includes(`id="${id}"`));
  assert.match(page('app.js'), /\/api\/auth\/login/);
});

test('application form retains the second login and customer context selection', () => {
  const html = page('app-login.html');
  for(const id of ['appLoginForm','email','organizationId','password','loginError','appTitle']) assert.ok(html.includes(`id="${id}"`));
  assert.match(page('app-login.js'), /\/api\/auth\/app-login/);
  assert.match(page('app-login.js'), /\/contexts/);
});

test('both login views use VSPH branding without unconfigured sign-in providers', () => {
  for(const name of ['login.html','app-login.html']) {
    const html = page(name);
    assert.match(html, /\/auth\.css/);
    assert.match(html, /\/auth-background\.js/);
    assert.doesNotMatch(html, /Continue with Google|Continue with GitHub|Continue with Apple|Sign Up/);
  }
});

test('brand specification is kept at project root', () => {
  const design = fs.readFileSync(path.join(root,'DESIGN.md'), 'utf8');
  assert.match(design, /#00255A/);
  assert.match(design, /#0069C8/);
  assert.match(design, /Building\s+What's Next/);
});

test('login uses extension-free routes while keeping HTML as the underlying view', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(server, /app\.get\(\['\/', '\/login'\]/);
  assert.match(server, /app\.get\('\/login\.html',\(req,res\)=>res\.redirect\(302,'\/login'\)\)/);
  assert.ok(server.indexOf("app.get('/login.html'") < server.indexOf("app.use(express.static("));
  assert.match(page('login.html'), /id="loginForm"/);
  for (const name of ['dashboard.js', 'admin.js', 'app-login.js', 'index.html', 'login.html']) {
    assert.doesNotMatch(page(name), /["']\/login\.html["']/);
  }
});

test('login pages omit redundant corner and footer slogans', () => {
  for (const name of ['login.html', 'app-login.html']) {
    const html = page(name);
    assert.doesNotMatch(html, /SECURE WORKSPACE|People \| Products \| Possibilities/);
    assert.doesNotMatch(html, /header-caption/);
  }
});

test('portal login keeps the form but removes nonessential decoration and note', () => {
  const html = page('login.html');
  assert.match(html, /class="auth-page portal-auth"/);
  assert.match(html, /<div class="intro-kicker">ENTERPRISE SOFTWARE<\/div>/);
  assert.doesNotMatch(html, /class="intro-rule"|class="pixel-progress"/);
  assert.doesNotMatch(html, /Access is managed by your organization\.|class="card-foot"/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /© 2026 VSPH\. All rights reserved\./);
  assert.match(html, /Enterprise Software Solutions for a Smarter Tomorrow\./);
});

test('portal layout uses viewport sizing on desktop with a short-screen fallback', () => {
  const css = page('auth.css');
  assert.match(css, /body\.portal-auth \{ overflow: hidden; \}/);
  assert.match(css, /\.portal-auth \.auth-layout \{[\s\S]*?height: 100dvh;/);
  assert.match(css, /\.portal-auth \.auth-main \{[\s\S]*?min-height: 0;/);
  assert.match(css, /max-height: 699px/);
  assert.match(css, /max-width: 900px/);
  assert.match(css, /\.portal-auth \.auth-intro h1 \{/);
});
