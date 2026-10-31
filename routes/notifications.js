const express = require("express");
const { db, check } = require("../db");
const { portalSession } = require("../security");
const { uuid, rpcRoute } = require("../services/rpc");
const r = express.Router();
r.use(portalSession, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const invalid = () => {
  const e = Error("Invalid notification/report request.");
  e.validation = true;
  throw e;
};
const call = (req, action, data = {}) =>
  db()
    .rpc("notification_command", {
      p_actor: req.user.id,
      p_action: action,
      p_id: null,
      p_data: data,
    })
    .then(check);
r.get(
  "/",
  rpcRoute(async (req) => {
    await call(req, "dispatch");
    return call(req, "inbox");
  }),
);
r.post(
  "/retry",
  rpcRoute((req) => call(req, "retry")),
);
r.get(
  "/preferences",
  rpcRoute((req) => call(req, "preferences")),
);
r.post(
  "/preferences",
  rpcRoute((req) => {
    const d = req.body;
    if (
      !d ||
      Object.keys(d).sort().join(",") !== "assignments,delivery,overdue" ||
      Object.values(d).some((v) => typeof v !== "boolean")
    )
      invalid();
    return call(req, "preferences.save", d);
  }),
);
r.post(
  "/:notificationId/read",
  rpcRoute((req) => {
    if (!/^\d{1,16}$/.test(req.params.notificationId)) invalid();
    return call(req, "read", { notificationId: req.params.notificationId });
  }),
);
const reports = express.Router();
reports.use(portalSession, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
reports.get(
  "/",
  rpcRoute((req) => {
    const q = req.query;
    if (
      Object.keys(q).some(
        (k) =>
          ![
            "projectId",
            "organizationId",
            "ownerId",
            "status",
            "from",
            "to",
          ].includes(k),
      )
    )
      invalid();
    for (const key of ["projectId", "organizationId", "ownerId"])
      if (q[key] && !uuid(q[key])) invalid();
    if (
      q.status &&
      !["planned", "active", "paused", "completed", "archived"].includes(
        q.status,
      )
    )
      invalid();
    for (const key of ["from", "to"])
      if (
        q[key] &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(q[key]) ||
          Number.isNaN(Date.parse(q[key])) ||
          new Date(q[key]).toISOString().slice(0, 10) !== q[key])
      )
        invalid();
    if (q.from && q.to && q.from > q.to) invalid();
    const data = {};
    for (const key of ["organizationId", "ownerId", "status", "from", "to"])
      if (q[key]) data[key] = q[key];
    return db()
      .rpc("project_report", {
        p_actor: req.user.id,
        p_action: "list",
        p_id: q.projectId || null,
        p_data: data,
      })
      .then(check);
  }),
);
module.exports = { router: r, reports };
