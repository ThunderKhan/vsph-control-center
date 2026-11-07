const assert = require('node:assert/strict');
const { notificationBatch } = require('../../services/workers/notifications');
module.exports = async pool => {
  const admin = '44444444-4444-4444-8444-444444444444', user = '12121212-1111-4111-8111-111111111111';
  const pc = async (action, id, data) => (await pool.query('select project_command($1,$2,$3,$4) d', [admin, action, id, data])).rows[0].d;
  // This is the exact batch used by the finite CLI and supervised process,
  // with native PostgreSQL replacing only the HTTP transport, not the SQL.
  const client = { rpc: async (name, p) => {
    assert.equal(name, 'notification_command'); assert.equal(p.p_actor, null); assert.equal(p.p_id, null);
    try { return { data: (await pool.query('select notification_command($1,$2,$3,$4) d', [p.p_actor, p.p_action, p.p_id, p.p_data])).rows[0].d, error: null }; }
    catch (error) { return { data: null, error }; }
  } };
  await pool.query("insert into project_notification_preferences(user_id,assignments,delivery,overdue) values($1,true,true,true) on conflict(user_id) do update set assignments=true,delivery=true,overdue=true", [user]);
  const project = await pc('create', null, { key: 'WORKER-BATCH', name: 'Isolated worker operations', kind: 'internal' });
  await pc('member.save', project.id, { version: 1, userId: user, role: 'contributor', status: 'active' });
  const task = await pc('task.create', project.id, { version: 2, title: 'Durably scheduled work', assigneeId: user, dueOn: '2020-01-01' });
  await Promise.all([notificationBatch(client), notificationBatch(client)]);
  await notificationBatch(client);
  const rows = (await pool.query("select o.event_type,count(*)::int n from project_notifications n join project_notification_outbox o on o.id=n.outbox_id where n.project_id=$1 and n.user_id=$2 group by o.event_type", [project.id, user])).rows;
  assert.ok(rows.some(r => r.event_type === 'task.assigned')); assert.ok(rows.some(r => r.event_type === 'task.overdue'));
  assert.ok(rows.every(r => r.n === 1));
  await pool.query("update project_memberships set status='revoked' where project_id=$1 and user_id=$2", [project.id, user]);
  await notificationBatch(client);
  const inbox = (await pool.query("select notification_command($1,'inbox',null,'{}') d", [user])).rows[0].d;
  assert.ok(!inbox.notifications.some(n => n.project_id === project.id));
  assert.ok(task.id);
  let calls = 0;
  await assert.rejects(notificationBatch({ rpc: async () => { calls++; return { error: Error('provider unavailable') }; } }));
  assert.equal(calls, 1, 'dispatch must not follow a failed scan');
};
