const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express");
const { once } = require("node:events");
const calls = [];
const dbPath = require.resolve("../db");
const previous = require.cache[dbPath];
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    check: ({ data, error }) => {
      if (error) throw error;
      return data;
    },
    db: () => ({
      rpc: async (name, a) => {
        calls.push(a.p_action);
        return {
          data:
            a.p_action === "inspect"
              ? { newIdentity: true }
              : a.p_action === "reserve_accept"
                ? {
                    newIdentity: true,
                    userId: "11111111-1111-4111-8111-111111111111",
                  }
                : { ok: true },
          error: null,
        };
      },
      auth: {
        admin: {
          updateUserById: async () => ({
            error: Error("Confidential provider error"),
          }),
        },
      },
    }),
  },
};
const router = require("../routes/invitations");
if (previous) require.cache[dbPath] = previous;
else delete require.cache[dbPath];
async function server(fn) {
  const app = express();
  app.use(express.json());
  app.use("/api/invitations", router);
  app.use((e, req, res, next) =>
    res.status(500).json({ message: "Enrollment requires reconciliation." }),
  );
  const s = app.listen(0, "127.0.0.1");
  await once(s, "listening");
  try {
    await fn("http://127.0.0.1:" + s.address().port);
  } finally {
    await new Promise((r) => s.close(r));
  }
}
test("external password enrollment failure never activates membership and enters durable attention", async () => {
  calls.length = 0;
  await server(async (base) => {
    const r = await fetch(base + "/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitationId: "22222222-2222-4222-8222-222222222222",
        token: "a".repeat(43),
        password: "synthetic-long-password",
      }),
    });
    assert.equal(r.status, 500);
    assert.doesNotMatch(await r.text(), /Confidential/);
  });
  assert.deepEqual(calls, ["inspect", "reserve_accept", "accept_failed"]);
});
test("legacy broad bearer activation is rejected before any provider call", async () => {
  calls.length = 0;
  await server(async (base) => {
    const r = await fetch(base + "/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: "old-bearer",
        password: "synthetic-password",
      }),
    });
    assert.equal(r.status, 400);
  });
  assert.deepEqual(calls, []);
});
