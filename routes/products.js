const express = require("express");
const { db, check } = require("../db");
const { uuid, rpcRoute } = require("../services/rpc");
const { adapter } = require("../products/adapters");
const { musicConfig } = require("../integration/sso-config");
const router = express.Router();
function validateProduct(body) {
  const allowed = [
    "code",
    "name",
    "loginPath",
    "status",
    "version",
    "description",
    "ownerId",
    "supportEmail",
    "docsUrl",
    "visibility",
    "integrationMode",
  ];
  if (!body || Object.keys(body).some((k) => !allowed.includes(k)))
    throw Error(
      "Unknown product fields. Secrets must stay in server configuration.",
    );
  const data = { ...body };
  if (
    typeof data.code !== "string" ||
    !/^[A-Z][A-Z0-9_]{1,39}$/.test(data.code) ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 150 ||
    data.loginPath !== "/apps/" + data.code.toLowerCase() + "/login" ||
    !["active", "disabled", "maintenance", "retired"].includes(data.status) ||
    !["listed", "unlisted"].includes(data.visibility) ||
    !["adapter", "portal_only"].includes(data.integrationMode)
  )
    throw Error("Invalid product metadata.");
  if (data.ownerId && !uuid(data.ownerId))
    throw Error("Owner must be an active account UUID.");
  if (
    data.description !== undefined &&
    (typeof data.description !== "string" || data.description.length > 2000)
  )
    throw Error("Description is too long.");
  if (
    data.supportEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.supportEmail)
  )
    throw Error("Invalid support email.");
  if (data.docsUrl) {
    const u = new URL(data.docsUrl);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.hash ||
      u.search
    )
      throw Error(
        "Documentation URL must be HTTPS without credentials, query or fragment.",
      );
  }
  return data;
}
const cmd = (req, action, id, data = {}) =>
  db()
    .rpc("product_command", {
      p_actor: req.user.id,
      p_action: action,
      p_id: id,
      p_data: data,
    })
    .then(check);
router.get(
  "/",
  rpcRoute(async (req) => {
    const rows = await cmd(req, "list", null);
    return rows.map((p) => ({ ...p, readiness: readiness(p) }));
  }),
);
function readiness(p) {
  let configured = Boolean(adapter(p.code));
  if (p.integration_mode === "portal_only") configured = false;
  let configurationError = false;
  if (p.code === "MUSIC") {
    try {
      configured = Boolean(musicConfig());
    } catch {
      configured = false;
      configurationError = true;
    }
  }
  return {
    state:
      p.status !== "active"
        ? "unavailable"
        : configurationError
          ? "degraded"
          : configured
            ? "configured"
            : "unavailable",
    configured,
    reachable: null,
    verified: false,
    scope:
      p.code === "MUSIC"
        ? "external SSO (not verified)"
        : "reviewed local adapter",
    reason: configurationError
      ? "Server integration configuration is incomplete."
      : configured
        ? "Configuration exists; reachability and end-to-end acceptance are separate."
        : "No verified operational integration is configured.",
  };
}
for (const action of ["create", "update"])
  router.post(
    "/" + action + "/:id",
    rpcRoute((req) => {
      if (!uuid(req.params.id)) {
        const e = Error("Invalid product ID.");
        e.validation = true;
        throw e;
      }
      let data;
      try {
        data = validateProduct(req.body);
      } catch (e) {
        e.validation = true;
        throw e;
      }
      return cmd(req, action, req.params.id, data);
    }),
  );
router.post(
  "/:id/check",
  rpcRoute(async (req) => {
    if (!uuid(req.params.id)) {
      const e = Error("Invalid product ID.");
      e.validation = true;
      throw e;
    }
    const product = (await cmd(req, "list", null)).find(
      (p) => p.id === req.params.id,
    );
    if (!product) {
      const e = Error("Product missing");
      e.code = "P0002";
      throw e;
    }
    const result = readiness(product),
      selected = adapter(product.code);
    // Fixed reviewed table only: never fetch an admin-supplied URL or interpolate a product code into SQL.
    if (
      product.status === "active" &&
      selected &&
      product.integration_mode === "adapter"
    ) {
      try {
        check(await db().from(selected.table).select("id").limit(1));
        result.localAdapterReachable = true;
        if (product.code !== "MUSIC") {
          result.reachable = true;
          result.state = "reachable";
        }
        result.scope =
          "local database adapter only; external provider remains unverified";
      } catch {
        result.reachable = false;
        result.state = "degraded";
        result.reason = "Local operational adapter query failed.";
      }
    }
    const observation = { ...result, checkedAt: new Date().toISOString() };
    await cmd(req, "probe", product.id, {
      version: product.version,
      ...observation,
    });
    return observation;
  }),
);
module.exports = { router, validateProduct, readiness };
