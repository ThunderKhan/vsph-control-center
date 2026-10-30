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