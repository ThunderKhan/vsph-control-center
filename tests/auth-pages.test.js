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

test('portal form uses a plain, centered sign-in action', () => {
  const html = page('login.html');
  const css = page('auth.css');
  const js = page('app.js');
  assert.match(html, /<div class="card-kicker">VSPH CONTROL CENTER<\/div>/);
  assert.doesNotMatch(html, /class="card-arrow"/);
  assert.match(html, /<button id="loginButton" class="auth-submit" type="submit"><span class="submit-label">Sign in<\/span><\/button>/);
  assert.match(css, /\.portal-auth \.auth-submit\{justify-content:center;text-align:center\}/);
  assert.match(js, /label\.textContent = 'Sign in';/);
});

test('password visibility controls show accessible eye and eye-off icons on both login forms', () => {
  for (const name of ['login.html', 'app-login.html']) {
    const html = page(name);
    assert.match(html, /data-password-toggle="password"/);
    assert.match(html, /aria-label="Show password"/);
    assert.match(html, /aria-controls="password"/);
    assert.match(html, /data-icon="show"/);
    assert.match(html, /data-icon="hide"/);
    assert.match(html, /data-icon="hide"[^>]*hidden/);
    assert.doesNotMatch(html, />Show<\/button>/);
  }
  for (const name of ['app.js', 'app-login.js']) {
    const js = page(name);
    assert.match(js, /\[data-icon="show"\]/);
    assert.match(js, /\[data-icon="hide"\]/);
    assert.match(js, /target\.type = shown \? 'text' : 'password'|password\.type = shown \? 'text' : 'password'/);
    assert.match(js, /setAttribute\('aria-label', shown \? 'Hide password' : 'Show password'\)/);
  }
  const css = page('auth.css');
  assert.match(css, /\.reveal svg\[hidden\]\{display:none\}/);
  assert.match(css, /width:44px;height:44px/);
});
