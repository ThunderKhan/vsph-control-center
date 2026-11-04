const assert = require("node:assert/strict");
module.exports = async (pool) => {
  const admin = "44444444-4444-4444-8444-444444444444",
    user = "12121212-1111-4111-8111-111111111111";
  const pc = async (a, id, d) =>
    (
      await pool.query("select project_command($1,$2,$3,$4) data", [
        admin,
        a,
        id,
        d,
      ])
    ).rows[0].data;
  const nc = async (a, d = {}, actor = user) =>
    (
      await pool.query("select notification_command($1,$2,null,$3) data", [
        actor,
        a,
        d,
      ])
    ).rows[0].data;
  const p = await pc("create", null, {
    key: "NOTICES",
    name: "Notification fixture",
    kind: "internal",
  });
  await pc("member.save", p.id, {
    version: 1,
    userId: user,
    role: "contributor",
    status: "active",
  });
  await pc("task.create", p.id, {
    version: 2,
    title: "Assigned delivery",
    assigneeId: user,
    dueOn: "2020-01-01",
  });
  assert.ok((await nc("dispatch")).processed >= 1);
  let inbox = await nc("inbox");
  assert.ok(inbox.notifications.some((n) => n.title === "Assigned delivery"));
  const first = inbox.notifications.length;
  await nc("dispatch");
  assert.equal((await nc("inbox")).notifications.length, first);
  const n = inbox.notifications.find((n) => n.title === "Assigned delivery");
  await nc("read", { notificationId: n.id }, admin);
  assert.equal(
    (await nc("inbox")).notifications.find((x) => x.id === n.id).read_at,
    null,
  );
  await nc("read", { notificationId: n.id });
  assert.ok(
    (await nc("inbox")).notifications.find((x) => x.id === n.id).read_at,
  );
  await nc("scan", {}, null);
  await nc("scan", {}, null);
  await nc("dispatch");
  assert.equal(
    (await nc("inbox")).notifications.filter(
      (x) => x.project_id === p.id && x.event_type === "task.overdue",
    ).length,
    1,
  );
  await nc("preferences.save", {
    assignments: false,
    delivery: false,
    overdue: false,
  });
  await pc("task.create", p.id, {
    version: 3,
    title: "Opted out",
    assigneeId: user,
  });
  await nc("dispatch");
  assert.ok(
    !(await nc("inbox")).notifications.some((x) => x.title === "Opted out"),
  );
  await nc("preferences.save", {
    assignments: true,
    delivery: true,
    overdue: true,
  });
  await pc("task.create", p.id, {
    version: 4,
    title: "Retry notice",
    assigneeId: user,
  });
  await pool.query(
    `create function public.fixture_notice_failure() returns trigger language plpgsql as $$begin raise exception 'Fixture outage';end$$;create trigger notice_failure before insert on public.project_notifications for each row execute function public.fixture_notice_failure()`,
  );
  try {
    await nc("dispatch");
    assert.ok(
      (
        await pool.query(
          "select attempts,state from project_notification_outbox where user_id=$1 and project_id=$2 and state='queued'",
          [user, p.id],
        )
      ).rows.some((x) => x.attempts === 1),
    );
  } finally {
    await pool.query(
      "drop trigger notice_failure on project_notifications;drop function fixture_notice_failure()",
    );
  }
  await pool.query(
    "update project_notification_outbox set available_at=now() where project_id=$1",
    [p.id],
  );
  await nc("dispatch");
  assert.ok(
    (await nc("inbox")).notifications.some((x) => x.title === "Retry notice"),
  );
  const report = await pool.query(
    "select project_report($1,'list',null,'{}') data",
    [user],
  );
  assert.equal(
    report.rows[0].data.projects.filter((x) => x.id === p.id)[0].overdue_tasks,
    1,
  );
  await pc("member.save", p.id, {
    version: 5,
    userId: user,
    role: "contributor",
    status: "revoked",
  });
  assert.ok(
    !(await nc("inbox")).notifications.some((x) => x.project_id === p.id),
  );
  assert.ok(
    !(
      await pool.query("select project_report($1,'list',null,'{}') data", [
        user,
      ])
    ).rows[0].data.projects.some((x) => x.id === p.id),
  );
};
