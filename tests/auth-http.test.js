const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const {once} = require('node:events');

// Exercise the *actual Express route stack* with no credentials and no
// Supabase connection. These pages must reject anonymous visitors before
// any database query is attempted.
test('direct URL visits cannot bypass VSPH portal login', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    for (const path of [
      '/apps/music/login', '/apps/music/launch', '/apps/music/home',
      '/apps/crm/login', '/apps/crm/home',
      '/dashboard', '/applications', '/admin'
    ]) {
      const response = await fetch(origin + path, {redirect: 'manual'});
      assert.equal(response.status, 302, path);
      assert.equal(response.headers.get('location'), '/login', path);
      assert.match(response.headers.get('cache-control') || '', /no-store/, path);
    }

    for (const path of [
      '/api/auth/me', '/api/apps', '/api/apps/MUSIC/records'
    ]) {
      const response = await fetch(origin + path, {redirect: 'manual'});
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get('content-type').startsWith('application/json'), true, path);
      assert.match(response.headers.get('cache-control') || '', /no-store/, path);
    }

    // Old bookmarks normalize to clean URLs; the destination still enforces login.
    for (const [legacy, clean] of [
      ['/dashboard.html','/dashboard'], ['/applications.html','/applications'],
      ['/admin.html','/admin'], ['/login.html','/login'], ['/index.html','/login']
    ]) {
      const response = await fetch(origin + legacy, {redirect:'manual'});
      assert.equal(response.status,302,legacy);
      assert.equal(response.headers.get('location'),clean,legacy);
    }
    for (const path of ['/app-home.html', '/app-login.html']) {
      const response = await fetch(origin + path, {redirect: 'manual'});
      assert.equal(response.status, 404, path);
    }
    const portal = await fetch(origin + '/login', {redirect: 'manual'});
    assert.equal(portal.status, 200);
    assert.match(await portal.text(), /VSPH CONTROL CENTER/);
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
