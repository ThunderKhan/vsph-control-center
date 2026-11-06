require('dotenv').config({ quiet: true });
const { configured } = require('../db');
const { workerJobs } = require('../services/workers/configuration');
const { createSupervisor } = require('../services/workers/supervisor');
async function main(args = process.argv.slice(2)) {
  if (args.some(a => a !== '--once') || args.length > 1) throw Error('Use workers or workers -- --once.');
  if (!configured()) throw Error('Worker database configuration is incomplete.');
  const jobs = workerJobs(); // Validate ALL requested jobs before any side effects.
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const supervisor = createSupervisor(jobs, { emit: state => console.log(JSON.stringify({ event: 'worker_batch', ...state })) });
    const result = await supervisor.start({ signal: abort.signal, once: args.includes('--once') });
    if (!result.ok && !abort.signal.aborted) process.exitCode = 1;
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
if (require.main === module) main().catch(() => {
  console.error('Worker startup or scheduling failed. Check worker configuration and durable recovery views; no provider details are logged.');
  process.exitCode = 1;
});
module.exports = { main };
