const test = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  express = require("express");
const { webhook } = require("../routes/delivery");
async function fixture(fn) {
  const calls = [];
  const app = express();
  app.post(
    "/",
    express.raw({ type: "application/json" }),
    webhook({
      secret: "fixture-secret",
      call: async (...args) => {
        calls.push(args);
        return { accepted: true };
      },
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn("http://127.0.0.1:" + server.address().port, calls);
  } finally {
    server.close();
  }
}
const id = crypto.randomUUID();
const headers = (body) => ({
  "content-type": "application/json",
  "x-github-delivery": id,
  "x-github-event": "pull_request",
  "x-hub-signature-256":
    "sha256=" +
    crypto.createHmac("sha256", "fixture-secret").update(body).digest("hex"),
});
test("raw-body signature verified before parsing or persisting any event", () =>
  fixture(async (url, calls) => {
    const body = JSON.stringify({
      installation: { id: 7 },
      repository: { id: 9 },
    });
    const denied = await fetch(url, {
      method: "POST",
      body,
      headers: {
        ...headers(body),
        "x-hub-signature-256": "sha256=" + "0".repeat(64),
      },
    });
    assert.equal(denied.status, 401);
    assert.equal(calls.length, 0);
    const accepted = await fetch(url, {
      method: "POST",
      body,
      headers: headers(body),
    });
    assert.equal(accepted.status, 202);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][3].repositoryId, 9);
    assert.ok(!JSON.stringify(calls).includes("fixture-secret"));
  }));
test("signature bound to exact bytes, delivery UUID and installation required", () =>
  fixture(async (url, calls) => {
    const body = '{"installation":{"id":7}}';
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          body: body + " ",
          headers: headers(body),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          body,
          headers: { ...headers(body), "x-github-delivery": "invalid" },
        })
      ).status,
      401,
    );
    const missing = "{}";
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          body: missing,
          headers: headers(missing),
        })
      ).status,
      400,
    );
    assert.equal(calls.length, 0);
  }));
