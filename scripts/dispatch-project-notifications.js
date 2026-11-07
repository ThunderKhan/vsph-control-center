require('dotenv').config({ quiet: true });
const { notificationBatch } = require('../services/workers/notifications');
if (require.main === module) notificationBatch().then(() => {
  console.log(JSON.stringify({ completed: true }));
}).catch(() => {
  console.error('Project notification batch failed. Inspect durable outbox state.');
  process.exitCode = 1;
});
