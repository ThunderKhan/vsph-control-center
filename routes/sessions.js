const express = require("express"),
  { portalSession } = require("../security"),
  { db, check } = require("../db"),
  { rpcRoute, uuid } = require("../services/rpc");
const router = express.Router();
router.use(portalSession, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const call = (req, action, id = null) =>
  db()
    .rpc("session_command", {
      p_actor: req.user.id,
      p_action: action,
      p_id: id,
      p_data: { currentHash: req.portalSession.token_hash },
    })
    .then(check);
router.get(
  "/",
  rpcRoute((req) => call(req, "list")),
);
router.post(
  "/revoke-others",
  rpcRoute((req) => call(req, "revoke_others")),
);
router.post(
  "/:id/revoke",
  rpcRoute((req) => {
    if (!uuid(req.params.id)) {
      const e = Error("Invalid session.");
      e.validation = true;
      throw e;
    }
    return call(req, "revoke", req.params.id);
  }),
);
module.exports = router;
