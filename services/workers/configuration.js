const path = require('node:path');
function workerJobs(env = process.env) {
  const names = (env.WORKER_JOBS ?? 'notifications').split(',').map(s => s.trim());
  if (!names.length || names.some(n => !['notifications', 'github', 'invitations'].includes(n)) || new Set(names).size !== names.length) throw Error('WORKER_JOBS must contain unique notifications, github or invitations names.');
  if (names.includes('github') && !require('../github/provider').configuration(env)) throw Error('GitHub worker requires an enabled configured GitHub App.');
  if (names.includes('invitations')) {
    let target, origin;
    try { target = new URL(env.INVITATION_DELIVERY_URL); origin = new URL(env.PUBLIC_ORIGIN); } catch { throw Error('Invitation worker configuration is incomplete.'); }
    if (env.INVITATION_DELIVERY_ENABLED !== 'true' || target.protocol !== 'https:' || target.username || target.password || target.hash || !env.INVITATION_DELIVERY_SECRET || !/^[a-f0-9]{64}$/i.test(env.INVITATION_OUTBOX_KEY || '') || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) || origin.username || origin.password) throw Error('Invitation worker needs explicit delivery enablement, approved HTTPS provider, encryption key and trusted origin.');
  }
  const scripts = { notifications: 'dispatch-project-notifications.js', github: 'sync-github.js', invitations: 'dispatch-invitations.js' };
  return names.map(name => ({ name, script: path.join(__dirname, '../../scripts', scripts[name]), intervalMs: name === 'invitations' ? 10000 : 60000, timeoutMs: 300000 }));
}
module.exports = { workerJobs };
