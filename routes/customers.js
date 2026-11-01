const express = require("express");
const { db, check } = require("../db");
const { uuid, rpcRoute } = require("../services/rpc");
const router = express.Router();
function validateInvite(body, organizationId) {
  if (
    !uuid(organizationId) ||
    !body ||
    Object.keys(body).some(
      (k) => !["name", "email", "memberRole", "products"].includes(k),
    )
  )
    throw Error("Invalid invitation fields.");
  const adminName = String(body.name || "").trim(),
    adminEmail = String(body.email || "")
      .trim()
      .toLowerCase();
  if (
    !adminName ||
    adminName.length > 150 ||
    adminEmail.length > 190 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) ||
    !["admin", "member", "viewer"].includes(body.memberRole) ||
    !Array.isArray(body.products) ||
    body.products.length > 12
  )
    throw Error(
      "Provide name, email, organization role and explicit product roles.",
    );
  const ids = new Set();
  for (const p of body.products) {
    if (
      !p ||
      Object.keys(p).some((k) => !["applicationId", "role"].includes(k)) ||
      !uuid(p.applicationId) ||
      ids.has(p.applicationId) ||
      ![
        "super_admin",
        "admin",
        "manager",
        "user",
        "viewer",
        "staff",
        "musician",
      ].includes(p.role)
    )
      throw Error("Invalid or duplicate product role.");
    ids.add(p.applicationId);
  }
  return {
    kind: "member",
    organizationId,
    adminName,
    adminEmail,
    memberRole: body.memberRole,
    products: body.products,
  };
}
const cmd = (req, action, id, data = {}) =>
  db()
    .rpc("customer_command", {
      p_actor: req.user.id,
      p_action: action,
      p_id: id,
      p_data: data,
    })
    .then(check);
router.get(
  "/",
  rpcRoute((req) => {
    if (req.query.afterId && !uuid(req.query.afterId)) {
      const e = Error("Invalid cursor");
      e.validation = true;
      throw e;
    }
    return cmd(req, "list", null, { afterId: req.query.afterId });
  }),
);
router.get(
  "/:id",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) {
      const e = Error("Invalid organization.");
      e.validation = true;
      throw e;
    }
    return cmd(req, "read", req.params.id);
  }),
);
router.post(
  "/:id/invitations",
  rpcRoute(async (req, res) => {
    let data;
    try {
      data = validateInvite(req.body, req.params.id);
    } catch (e) {
      e.validation = true;
      throw e;
    }
    const key = req.get("Idempotency-Key");
    if (!uuid(key))
      return res
        .status(400)
        .json({ message: "A UUID Idempotency-Key is required." });
    const job = check(
      await db().rpc("provisioning_command", {
        p_actor: req.user.id,
        p_action: "begin_member",
        p_id: key,
        p_data: data,
      }),
    );
    res.status(202);
    return {
      id: job.id,
      message: "Invitation queued. Delivery is not yet confirmed.",
    };
  }),
);
for (const action of ["member", "role"])
  router.post(
    "/:id/" + action,
    rpcRoute((req) => {
      const fields =
        action === "member"
          ? ["userId", "version", "role", "status"]
          : ["userId", "version", "role", "applicationId"];
      if (
        !uuid(req.params.id) ||
        !uuid(req.body?.userId) ||
        !Number.isSafeInteger(req.body.version) ||
        req.body.version < 1 ||
        Object.keys(req.body).some((k) => !fields.includes(k))
      ) {
        const e = Error("Invalid membership mutation.");
        e.validation = true;
        throw e;
      }
      return cmd(req, action, req.params.id, req.body);
    }),
  );
router.get(
  "/:id/impact",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) {
      const e = Error("Invalid organization");
      e.validation = true;
      throw e;
    }
    return db()
      .rpc("customer_lifecycle", {
        p_actor: req.user.id,
        p_action: "preview",
        p_id: req.params.id,
        p_data: {},
      })
      .then(check);
  }),
);
router.post(
  "/:id/lifecycle/:action",
  rpcRoute((req) => {
    if (
      !uuid(req.params.id) ||
      !["status", "entitlement", "subscription", "access"].includes(
        req.params.action,
      ) ||
      !Number.isSafeInteger(req.body?.version)
    ) {
      const e = Error("Invalid lifecycle request");
      e.validation = true;
      throw e;
    }
    return db()
      .rpc("customer_lifecycle", {
        p_actor: req.user.id,
        p_action: req.params.action,
        p_id: req.params.id,
        p_data: req.body,
      })
      .then(check);
  }),
);
module.exports = { router, validateInvite };
