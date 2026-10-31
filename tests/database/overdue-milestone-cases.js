const assert = require("node:assert/strict");
module.exports = async (pool) => {
  const admin = "44444444-4444-4444-8444-444444444444",
    user = "11111111-1111-4111-8111-111111111111";
  const pc = async (a, id, d) =>
    (
      await pool.query("select project_command($1,$2,$3,$4) data", [
        admin,
        a,
        id,
        d,
      ])
    ).rows[0].data;
  const nc = async (a, actor = user, d = {}) =>
    (
      await pool.query("select notification_command($1,$2,null,$3) data", [
        actor,
        a,
        d,
      ])
    ).rows[0].data;
  const p = await pc("create", null, {
    key: "MILESTONE-NOTICE",
    name: "Milestone notification fixture",
    kind: "internal",
  });
  await pc("member.save", p.id, {
    version: 1,
    userId: user,
    role: "manager",
    status: "active",
  });
  const m = await pc("milestone.create", p.id, {
    version: 2,
    title: "Overdue milestone fixture",
    dueOn: "2020-01-01",
  });
  await nc("scan", null);
  await nc("scan", null);
  await nc("dispatch");
  const notices = (await nc("inbox")).notifications.filter(
    (n) => n.project_id === p.id && n.event_type === "milestone.overdue",
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, "Overdue milestone fixture");
  const count = async () =>
    Number(
      (
        await pool.query(
          "select count(*) from project_notification_outbox where entity_id=$1 and event_type='milestone.overdue'",
          [m.id],
        )
      ).rows[0].count,
    );
  assert.equal(await count(), 2);
  await pc("milestone.update", p.id, {
    version: 3,
    id: m.id,
    status: "active",
  });
  await pc("milestone.update", p.id, { version: 4, id: m.id, status: "done" });
  await nc("scan", null);
  assert.equal(await count(), 2);
  await nc("dispatch", admin);
  assert.ok(
    !(await nc("inbox", admin)).notifications.some(
      (n) => n.project_id === p.id && n.event_type === "milestone.overdue",
    ),
  );
  await nc("preferences.save", user, {
    assignments: true,
    delivery: true,
    overdue: false,
  });
  const muted = await pc("milestone.create", p.id, {
    version: 5,
    title: "Muted overdue milestone",
    dueOn: "2020-01-01",
  });
  await nc("scan", null);
  await nc("dispatch");
  assert.ok(
    !(await nc("inbox")).notifications.some(
      (n) =>
        n.project_id === p.id &&
        n.title === "Muted overdue milestone" &&
        n.event_type === "milestone.overdue",
    ),
  );
  await nc("preferences.save", user, {
    assignments: true,
    delivery: true,
    overdue: true,
  });
  await pc("member.save", p.id, {
    version: 6,
    userId: user,
    role: "viewer",
    status: "active",
  });
  assert.ok(
    !(await nc("inbox")).notifications.some(
      (n) => n.project_id === p.id && n.event_type === "milestone.overdue",
    ),
  );
  await pool.query(
    "update project_notification_outbox set state='queued',available_at=now() where entity_id=$1 and user_id=$2",
    [muted.id, user],
  );
  await nc("dispatch");
  assert.equal(
    (
      await pool.query(
        "select state from project_notification_outbox where entity_id=$1 and user_id=$2",
        [muted.id, user],
      )
    ).rows[0].state,
    "suppressed",
  );
  await pc("member.save", p.id, {
    version: 7,
    userId: user,
    role: "viewer",
    status: "revoked",
  });
  assert.ok(
    !(await nc("inbox")).notifications.some((n) => n.project_id === p.id),
  );
  assert.equal(
    Number(
      (
        await pool.query(
          "select count(*) from project_notification_outbox where entity_id=$1 and user_id=$2",
          [muted.id, user],
        )
      ).rows[0].count,
    ),
    1,
  );
};
