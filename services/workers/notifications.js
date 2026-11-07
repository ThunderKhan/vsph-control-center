const { db, check } = require('../../db');
async function notificationBatch(client = db()) {
  const summary = {};
  for (const action of ['scan', 'dispatch']) {
    const result = await client.rpc('notification_command', { p_actor: null, p_action: action, p_id: null, p_data: {} }).then(check);
    summary[action] = result;
  }
  return summary;
}
module.exports = { notificationBatch };
