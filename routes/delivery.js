const express = require("express");
const crypto = require("node:crypto");
const { db, check } = require("../db");
const { portalSession } = require("../security");
const { rpcRoute, uuid } = require("../services/rpc");
const {
  client,
  configuration,
  ProviderError,
} = require("../services/github/provider");
const { tick } = require("../services/github/sync");
const command = (actor, action, id, data = {}) =>
  db()
    .rpc("delivery_command", {
      p_actor: actor,
      p_action: action,
      p_id: id,
      p_data: data,
    })
    .then(check);
const invalid = () => {
  const e = Error("Invalid delivery request.");
  e.validation = true;
  throw e;
};
const number = (x) => Number.isSafeInteger(Number(x)) && Number(x) > 0;
function fields(body, allowed) {
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    Object.keys(body).some((k) => !allowed.includes(k))
  )
    invalid();
}
function router({ provider = client(), call = command } = {}) {
  const r = express.Router({ mergeParams: true });
  r.use(portalSession, (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!uuid(req.params.projectId))
      return res.status(400).json({ message: "Invalid project." });
    next();
  });
  const run = (fn) =>
    rpcRoute(async (req, res) => {
      try {
        return await fn(req, res);
      } catch (e) {
        if (e instanceof ProviderError) {
          res.status(503);
          return { message: "GitHub connection unavailable.", code: e.code };
        }
        throw e;
      }
    });
  const detail = (req) => call(req.user.id, "detail", req.params.projectId);
  async function manager(req) {
    const p = await db()
      .rpc("project_command", {
        p_actor: req.user.id,
        p_action: "detail",
        p_id: req.params.projectId,
        p_data: {},
      })
      .then(check);
    if (p.role !== "manager") {
      const e = Error();
      e.code = "42501";
      throw e;
    }
    return detail(req);
  }
  async function grant(req) {
    const d = await manager(req);
    const id = Number(req.body?.installationId || req.query.installationId);
    if (!number(id)) invalid();
    const g = d.installations.find(
      (x) => Number(x.installation_id) === id && x.status === "active",
    );
    if (!g) {
      const e = Error();
      e.code = "42501";
      throw e;
    }
    return g;
  }
  r.get(
    "/",
    run(async (req) => ({
      ...(await detail(req)),
      configured: Boolean(configuration()),
      vercel: {
        enabled: false,
        reason: "No verified project ownership mapping.",
      },
    })),
  );
  r.post(
    "/installations",
    run(async (req) => {
      fields(req.body, ["installationId"]);
      if (!number(req.body.installationId)) invalid();
      // Authorize platform scope before provider discovery; installation knowledge is sensitive.
      if (req.user.platform_role !== "super_admin") {
        const e = Error();
        e.code = "42501";
        throw e;
      }
      await manager(req);
      const g = await provider.installation(Number(req.body.installationId));
      return call(req.user.id, "grant", req.params.projectId, {
        installationId: g.id,
        accountId: g.accountId,
        accountLogin: g.accountLogin,
      });
    }),
  );
  r.post(
    "/installations/revoke",
    run((req) => {
      fields(req.body, ["installationId"]);
      if (!number(req.body.installationId)) invalid();
      return call(req.user.id, "grant.revoke", req.params.projectId, req.body);
    }),
  );
  r.get(
    "/repositories",
    run(async (req) => {
      const g = await grant(req);
      const page = Number(req.query.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 50) invalid();
      return provider.discover(g, page);
    }),
  );
  r.post(
    "/connections",
    run(async (req) => {
      fields(req.body, ["installationId", "repositoryId"]);
      if (!number(req.body.repositoryId)) invalid();
      const g = await grant(req);
      const repo = await provider.verifyRepository(
        g,
        Number(req.body.repositoryId),
      );
      return call(req.user.id, "connect", req.params.projectId, {
        ...repo,
        installationId: Number(g.installation_id),
      });
    }),
  );
  for (const action of ["disconnect", "sync"])
    r.post(
      "/connections/:connectionId/" + action,
      run(async (req) => {
        fields(req.body, ["version"]);
        if (
          !uuid(req.params.connectionId) ||
          !Number.isSafeInteger(req.body.version) ||
          req.body.version < 1
        )
          invalid();
        await call(
          req.user.id,
          action === "sync" ? "request" : "disconnect",
          req.params.projectId,
          { connectionId: req.params.connectionId, version: req.body.version },
        );
        if (action === "sync")
          return tick({
            command: call,
            provider,
            connectionId: req.params.connectionId,
          });
        return { saved: true };
      }),
    );
  r.post(
    "/links",
    run((req) => {
      fields(req.body, ["recordId", "taskId", "milestoneId"]);
      if (
        !uuid(req.body.recordId) ||
        Boolean(req.body.taskId) === Boolean(req.body.milestoneId) ||
        (req.body.taskId && !uuid(req.body.taskId)) ||
        (req.body.milestoneId && !uuid(req.body.milestoneId))
      )
        invalid();
      return call(req.user.id, "link", req.params.projectId, req.body);
    }),
  );
  return r;
}
function webhook({
  secret = process.env.GITHUB_WEBHOOK_SECRET,
  call = command,
} = {}) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!secret) return res.status(503).json({ message: "Webhook disabled." });
    const sig = req.get("x-hub-signature-256") || "",
      deliveryId = req.get("x-github-delivery");
    if (
      !Buffer.isBuffer(req.body) ||
      !/^sha256=[a-f0-9]{64}$/.test(sig) ||
      !uuid(deliveryId)
    )
      return res.status(401).json({ message: "Invalid webhook." });
    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(sig.slice(7), "hex")))
      return res.status(401).json({ message: "Invalid webhook." });
    try {
      const data = JSON.parse(req.body.toString("utf8")),
        event = req.get("x-github-event");
      if (
        ![
          "push",
          "pull_request",
          "release",
          "workflow_run",
          "check_run",
          "repository",
          "installation",
          "installation_repositories",
          "ping",
        ].includes(event)
      )
        return res.status(202).json({ ignored: true });
      if (event === "ping") return res.json({ accepted: true });
      if (!number(data.installation?.id))
        return res.status(400).json({ message: "Installation required." });
      const revoked =
        event === "installation" &&
        ["deleted", "suspend"].includes(data.action);
      const hash = crypto.createHash("sha256").update(req.body).digest("hex");
      res
        .status(202)
        .json(
          await call(null, "webhook", null, {
            deliveryId,
            hash,
            installationId: data.installation.id,
            repositoryId: data.repository?.id || 0,
            revoked,
          }),
        );
    } catch (e) {
      if (e instanceof SyntaxError)
        return res.status(400).json({ message: "Invalid webhook." });
      if (e.code === "40001")
        return res.status(409).json({ message: "Delivery identity conflict." });
      next(e);
    }
  };
}
module.exports = { router, webhook, command };
