const test = require('node:test'), assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const path = require('node:path'), os = require('node:os');
const { runProcess, createSupervisor } = require('../services/workers/supervisor');
const { workerJobs } = require('../services/workers/configuration');
const job = name => ({ name, script: name, intervalMs: 10, timeoutMs: 1000 });
test('worker selection is explicit, fixed and validates every provider before starting', () => {
  assert.deepEqual(workerJobs({}).map(j => j.name), ['notifications']);
  assert.ok(workerJobs({})[0].script.endsWith('dispatch-project-notifications.js'));
  for (const value of ['', 'notifications,notifications', 'notifications,unknown', '../scripts/seed.js', 'github', 'invitations']) assert.throws(() => workerJobs({ WORKER_JOBS: value }));
  const config = { WORKER_JOBS: 'notifications,invitations', INVITATION_DELIVERY_ENABLED: 'true', INVITATION_DELIVERY_URL: 'https://approved.fixture.test/invitations', INVITATION_DELIVERY_SECRET: 'not-a-real-secret', INVITATION_OUTBOX_KEY: 'a'.repeat(64), PUBLIC_ORIGIN: 'http://localhost:3000' };
  assert.equal(workerJobs(config).length, 2);
  for (const patch of [{ INVITATION_DELIVERY_ENABLED: 'false' }, { INVITATION_DELIVERY_URL: 'http://fixture.test' }, { INVITATION_DELIVERY_URL: 'https://user:password@fixture.test' }, { PUBLIC_ORIGIN: 'ftp://localhost' }, { INVITATION_OUTBOX_KEY: '' }]) assert.throws(() => workerJobs({ ...config, ...patch }));
});
test('supervisor isolates failures, emits safe snapshots and forbids overlapping start', async () => {
  let release; const held = new Promise(r => release = r), calls = [];
  const supervisor = createSupervisor([job('notifications'), job('github')], { random: () => 0, run: async name => { calls.push(name); if (name === 'github') throw Error('SECRET_PROVIDER_RESPONSE'); await held; } });
  const first = supervisor.start({ once: true });
  await assert.rejects(supervisor.start({ once: true }), /already running/);
  const copy = supervisor.snapshot(); copy[0].status = 'forged';
  assert.equal(supervisor.snapshot()[0].running, true); release();
  const result = await first;
  assert.equal(result.ok, false); assert.equal(result.jobs[0].status, 'ok'); assert.equal(result.jobs[1].failures, 1);
  assert.equal(result.jobs[1].nextDelayMs, 20); assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.deepEqual(calls.sort(), ['github', 'notifications']);
});
test('persistent scheduling backs off, recovers, never overlaps, and stops during wait', async () => {
  const abort = new AbortController(), delays = [], events = []; let attempts = 0, running = false;
  const supervisor = createSupervisor([job('notifications')], { random: () => 0, emit: e => events.push(e), run: async () => { assert.equal(running, false); running = true; await Promise.resolve(); running = false; if (++attempts < 3) throw Error('private'); }, pause: async ms => { delays.push(ms); if (delays.length === 3) abort.abort(); } });
  const result = await supervisor.start({ signal: abort.signal });
  assert.deepEqual(delays, [20, 40, 10]); assert.equal(attempts, 3); assert.equal(result.jobs[0].failures, 0);
  assert.ok(events.some(e => e.status === 'failed')); assert.ok(events.some(e => e.status === 'ok')); assert.ok(!JSON.stringify(events).includes('private'));
});
test('aborted supervisors do not start another batch and telemetry failures never redeliver', async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  const supervisor = createSupervisor([job('notifications')], { emit: () => { throw Error('log unavailable'); }, run: async () => { calls++; } });
  await supervisor.start({ signal: controller.signal }); assert.equal(calls, 0);
  assert.equal((await supervisor.start({ once: true })).ok, true); assert.equal(calls, 1);
});
test('real child processes are bounded, secret output discarded, and timeout/stop reap children', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vsph-worker-'));
  try {
    const ok = path.join(dir, 'ok.js'), bad = path.join(dir, 'bad.js'), slow = path.join(dir, 'slow.js');
    await writeFile(ok, "console.log('SECRET');console.error('SECRET');");
    await writeFile(bad, "console.error('SECRET');process.exit(7);");
    await writeFile(slow, "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
    await runProcess(ok, { timeoutMs: 3000 });
    await assert.rejects(runProcess(bad, { timeoutMs: 3000 }), /^Error: Worker batch failed\.$/);
    await assert.rejects(runProcess(slow, { timeoutMs: 250, killGraceMs: 25 }), /batch failed/);
    const abort = new AbortController(); const pending = runProcess(slow, { signal: abort.signal, timeoutMs: 3000, killGraceMs: 25 });
    abort.abort(); await assert.rejects(pending, /batch failed/);
    await assert.rejects(runProcess(ok, { signal: abort.signal }), /stopped/);
    await assert.rejects(runProcess(ok, { spawnImpl: () => { throw Error('SECRET'); } }), /batch failed/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
