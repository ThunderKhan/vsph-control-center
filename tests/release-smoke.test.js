const test = require("node:test");
const assert = require("node:assert/strict");
const { exactOrigin, verify, parseArgs, checks } = require("../scripts/verify-public-deployment");

test("release smoke requires exact HTTPS or local loopback origin", () => {
  assert.equal(exactOrigin("https://portal.example.com"), "https://portal.example.com");
  assert.equal(exactOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  for (const u of ["http://example.com", "https://portal.example.com/bad",
    "https://user:pass@portal.example.com", "https://portal.example.com/#token",
    "https://portal.example.com?q=1", "file:///tmp/test"]) {
    assert.throws(() => exactOrigin(u), /origin|HTTPS|Invalid/);
  }
  assert.deepEqual(parseArgs(["--help"]), { help: true });
  assert.throws(() => parseArgs(["--origin"]), /Usage/);
});

test("live smoke requires anonymous denial and database connectivity", async () => {
  const paths = new Map(checks.map(item => [item.path, item.expected]));
  const seen = [];
  const response = async (url, options) => {
    const path = new URL(url).pathname;
    seen.push({ path, options });
    return {
      status: paths.get(path),
      json: async () => ({ status: "ok", database: true,
        scope: "database-connectivity-only", releaseReady: false }),
      headers: { get: () => "text/html; charset=utf-8" },
    };
  };
  const result = await verify("https://portal.example.com", response);
  assert.equal(result.passed, true);
  assert.equal(seen.length, checks.length);
  assert.ok(seen.every(x => x.options.redirect === "manual" && x.options.credentials === "omit"));
  assert.match(result.limitation, /authenticated sessions/);
});

test("smoke fails closed for unknown health, disclosure and timeout", async () => {
  const response = async url => {
    const path = new URL(url).pathname;
    if (path === "/api/hrms/access") throw Error("Network unavailable");
    if (path === "/api/health") return { status: 503,
      json: async () => ({ status: "not_configured" }),
      headers: { get: () => "application/json" } };
    return { status: 200, json: async () => ({}), headers: { get: () => "text/html" } };
  };
  const result = await verify("http://localhost:3000", response);
  assert.equal(result.passed, false);
  for (const name of ["database-health", "hr-deny-anonymous", "projects-deny-anonymous"])
    assert.equal(result.checks.find(x => x.check === name).passed, false);
});

test("200 OK health must prove a configured database", async () => {
  const response = async url => ({
    status: new URL(url).pathname === "/api/health" ? 200 : 302,
    json: async () => ({ status: "not_configured", database: false }),
    headers: { get: () => "text/html" },
  });
  const result = await verify("https://portal.example.com", response);
  assert.equal(result.passed, false);
  assert.equal(result.checks[0].passed, false);
});
