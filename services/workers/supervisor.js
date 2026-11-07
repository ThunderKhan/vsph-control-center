const { spawn } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');

// Child output is deliberately discarded: providers must never leak delivery
// capabilities, user details or tokens into supervisor logs.
function runProcess(script, { signal, timeoutMs = 300000, killGraceMs = 5000, spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error('Worker stopped.'));
    let child, timeout, forced, settled = false;
    let interrupted = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout); clearTimeout(forced);
      signal?.removeEventListener('abort', terminate);
      error ? reject(Error('Worker batch failed.')) : resolve();
    };
    const terminate = () => {
      if (settled || interrupted) return;
      interrupted = true;
      child.kill('SIGTERM');
      forced = setTimeout(() => child.kill('SIGKILL'), killGraceMs);
    };
    try {
      child = spawnImpl(process.execPath, [script], { stdio: 'ignore', windowsHide: true, shell: false });
      child.once('error', () => finish(true));
      child.once('close', (code) => finish(interrupted || code !== 0));
      signal?.addEventListener('abort', terminate, { once: true });
      timeout = setTimeout(terminate, timeoutMs);
      if (signal?.aborted) terminate();
    } catch { finish(true); }
  });
}
function createSupervisor(jobs, { run = runProcess, emit = () => {}, now = Date.now, random = Math.random, pause = sleep } = {}) {
  if (!Array.isArray(jobs) || !jobs.length || new Set(jobs.map(j => j.name)).size !== jobs.length) throw Error('Unique worker jobs required.');
  const states = new Map(jobs.map(j => [j.name, { name: j.name, running: false, failures: 0, lastStartedAt: null, lastFinishedAt: null, lastSuccessAt: null, status: 'waiting', nextDelayMs: 0 }]));
  let active = false;
  const publish = state => { try { emit({ ...state }); } catch { /* Telemetry never repeats a completed batch. */ } };
  async function batch(job, signal) {
    const state = states.get(job.name);
    if (signal?.aborted) return;
    state.running = true; state.lastStartedAt = now(); state.status = 'running'; publish(state);
    try {
      await run(job.script, { signal, timeoutMs: job.timeoutMs });
      state.failures = 0; state.lastSuccessAt = now(); state.status = 'ok'; state.nextDelayMs = job.intervalMs;
    } catch {
      state.failures = Math.min(state.failures + 1, 20);
      state.status = signal?.aborted ? 'stopped' : 'failed';
      // Per-job exponential backoff, capped at 30 minutes, with bounded jitter.
      state.nextDelayMs = Math.min(1800000, job.intervalMs * 2 ** state.failures + Math.floor(random() * job.intervalMs));
    } finally {
      state.running = false; state.lastFinishedAt = now(); publish(state);
    }
  }
  async function start({ signal, once = false } = {}) {
    if (active) throw Error('Worker supervisor is already running.');
    active = true;
    try {
      await Promise.all(jobs.map(async job => {
        do {
          if (signal?.aborted) break;
          await batch(job, signal);
          if (once || signal?.aborted) break;
          try { await pause(states.get(job.name).nextDelayMs, undefined, { signal }); }
          catch { if (!signal?.aborted) throw Error('Worker scheduler failed.'); }
        } while (!signal?.aborted);
      }));
      return { ok: [...states.values()].every(s => s.status === 'ok'), jobs: [...states.values()].map(s => ({ ...s })) };
    } finally { active = false; }
  }
  return { start, snapshot: () => [...states.values()].map(s => ({ ...s })) };
}
module.exports = { runProcess, createSupervisor };
