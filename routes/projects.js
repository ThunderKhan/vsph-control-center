const express = require("express");
const { db, check } = require("../db");
const { portalSession } = require("../security");
const { uuid, rpcRoute } = require("../services/rpc");
const router = express.Router();
router.use(portalSession);
const invalid = () => {
  const e = Error("Invalid project data.");
  e.validation = true;
  throw e;
};
function validate(action, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) invalid();
  const allowed = {
    create: [
      "key",
      "name",
      "description",
      "kind",
      "customerOrganizationId",
      "ownerId",
      "priority",
      "startsOn",
      "dueOn",
      "clientVisible",
      "products",
    ],
    update: [
      "version",
      "name",
      "description",
      "ownerId",
      "status",
      "priority",
      "dueOn",
      "clientVisible",
      "products",
    ],
    "member.save": ["version", "userId", "role", "status", "team"],
    "milestone.create": ["version", "title", "dueOn", "shared"],
    "milestone.update": [
      "version",
      "id",
      "title",
      "status",
      "dueOn",
      "dependsOn",
      "shared",
    ],
    "task.create": [
      "version",
      "title",
      "description",
      "priority",
      "dueOn",
      "assigneeId",
      "milestoneId",
      "shared",
    ],
    "task.update": [
      "version",
      "id",
      "title",
      "description",
      "priority",
      "dueOn",
      "assigneeId",
      "milestoneId",
      "status",
      "shared",
    ],
    "comment.create": ["version", "body", "taskId", "shared"],
    "deliverable.create": ["version", "title", "url", "taskId", "shared"],
  }[action];
  if (!allowed || Object.keys(data).some((k) => !allowed.includes(k)))
    invalid();
  if (
    action !== "create" &&
    (!Number.isSafeInteger(data.version) || data.version < 1)
  )
    invalid();
  for (const k of [
    "id",
    "userId",
    "ownerId",
    "customerOrganizationId",
    "milestoneId",
    "taskId",
    "assigneeId",
    "dependsOn",
  ])
    if (
      data[k] !== undefined &&
      data[k] !== null &&
      data[k] !== "" &&
      !uuid(data[k])
    )
      invalid();
  for (const [key, max] of [
    ["name", 150],
    ["title", 200],
    ["description", 5000],
    ["body", 4000],
    ["team", 100],
  ])
    if (
      data[key] !== undefined &&
      (typeof data[key] !== "string" ||
        data[key].length > max ||
        (["name", "title", "body"].includes(key) && !data[key].trim()))
    )
      invalid();
  for (const k of ["startsOn", "dueOn"])
    if (
      data[k] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(data[k]) ||
        Number.isNaN(Date.parse(data[k])))
    )
      invalid();
  for (const k of ["shared", "clientVisible"])
    if (data[k] !== undefined && typeof data[k] !== "boolean") invalid();
  if (
    data.priority &&
    !["low", "normal", "high", "urgent"].includes(data.priority)
  )
    invalid();
  if (
    data.products !== undefined &&
    (!Array.isArray(data.products) ||
      data.products.length > 20 ||
      new Set(data.products).size !== data.products.length ||
      data.products.some((id) => !uuid(id)))
  )
    invalid();
  if (
    action === "create" &&
    (!/^[A-Z][A-Z0-9-]{1,19}$/.test(data.key || "") ||
      !data.name ||
      !["internal", "customer"].includes(data.kind) ||
      (data.kind === "customer") !== Boolean(data.customerOrganizationId))
  )
    invalid();
  if (action.endsWith(".create") && !(data.title || data.body)) invalid();
  if (action.endsWith(".update") && !uuid(data.id)) invalid();
  if (
    action === "member.save" &&
    (!uuid(data.userId) ||
      !["manager", "contributor", "viewer", "client"].includes(data.role) ||
      !["active", "revoked"].includes(data.status))
  )
    invalid();
  if (data.url !== undefined) {
    try {
      const u = new URL(data.url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        data.url.length > 2000
      )
        invalid();
    } catch {
      invalid();
    }
  }
  return data;
}
const call = (req, action, id, data) =>
  db()
    .rpc("project_command", {
      p_actor: req.user.id,
      p_action: action,
      p_id: id || null,
      p_data: data || {},
    })
    .then(check);
router.get(
  "/",
  rpcRoute((req) => {
    if (req.query.cursor && !uuid(req.query.cursor)) invalid();
    return call(req, "list", null, {
      q: String(req.query.q || "").slice(0, 100),
      status: String(req.query.status || ""),
      cursor: req.query.cursor || null,
    });
  }),
);
router.get(
  "/directory",
  rpcRoute((req) => {
    if (req.query.projectId && !uuid(req.query.projectId)) invalid();
    return call(req, "directory", req.query.projectId, {
      email: String(req.query.email || "").slice(0, 254),
    });
  }),
);
router.post(
  "/",
  rpcRoute((req, res) => {
    res.status(201);
    return call(req, "create", null, validate("create", req.body));
  }),
);
router.get(
  "/:id",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) invalid();
    return call(req, "detail", req.params.id);
  }),
);
router.patch(
  "/:id",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) invalid();
    return call(req, "update", req.params.id, validate("update", req.body));
  }),
);
const actions = {
  members: "member.save",
  milestones: "milestone.create",
  tasks: "task.create",
  comments: "comment.create",
  deliverables: "deliverable.create",
};
for (const [path, action] of Object.entries(actions))
  router.post(
    "/:id/" + path,
    rpcRoute((req) => {
      if (!uuid(req.params.id)) invalid();
      return call(req, action, req.params.id, validate(action, req.body));
    }),
  );
for (const [path, action] of [
  ["tasks", "task.update"],
  ["milestones", "milestone.update"],
])
  router.patch(
    "/:id/" + path + "/:entity",
    rpcRoute((req) => {
      if (!uuid(req.params.id) || !uuid(req.params.entity)) invalid();
      return call(
        req,
        action,
        req.params.id,
        validate(action, { ...req.body, id: req.params.entity }),
      );
    }),
  );
module.exports = { router, validate };
