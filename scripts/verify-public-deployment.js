// Strict, anonymous, read-only acceptance of a deployed Control Center instance.
// Secrets and existing user sessions are never sent to this script.
"use strict";

const checks = Object.freeze([
  { path: "/api/health", expected: 200, name: "database-health" },
  { path: "/login", expected: 200, name: "public-login" },
  { path: "/api/projects", expected: 401, name: "projects-deny-anonymous" },
  { path: "/api/hrms/access", expected: 401, name: "hr-deny-anonymous" },
  { path: "/api/admin-management/onboardings", expected: 401, name: "onboarding-deny-anonymous" },
  { path: "/admin/project-managers", expected: 302, name: "managers-redirect-anonymous" },
  { path: "/applications", expected: 302, name: "applications-redirect-anonymous" },
]);

function exactOrigin(value) {
  if (typeof value !== "string" || !value) throw Error("Explicit --origin is required.");
  let url;
  try { url = new URL(value); } catch { throw Error("Invalid origin."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.origin + "/" !== value && url.origin !== value))
    throw Error("Use an exact HTTPS origin without credentials, path, query or fragment (loopback HTTP allowed).");
  return url.origin;
}

async function verify(origin, fetcher = globalThis.fetch) {
  const base = exactOrigin(origin), results = [];
  for (const item of checks) {
    let passed = false, reason = "Unexpected response";
    try {
      const response = await fetcher(base + item.path, {
        method: "GET", redirect: "manual", credentials: "omit", cache: "no-store",
        headers: { Accept: item.name === "database-health" ? "application/json" : "*/*" },
        signal: AbortSignal.timeout(8000),
      });
      passed = response.status === item.expected;
      reason = passed ? "Correct status" : "Unexpected HTTP status";
      if (passed && item.name === "database-health") {
        const body = await response.json();
        passed = Boolean(body && body.status === "ok" && body.database === true &&
          body.scope === "database-connectivity-only");
        reason = passed ? "Database reachable; health alone does not prove release readiness" :
          "Health payload is not connected to database";
      }
      if (passed && item.name === "public-login") {
        passed = String(response.headers.get("content-type") || "").toLowerCase().includes("text/html");
        reason = passed ? "HTML entry point available" : "Unexpected login content type";
      }
    } catch { reason = "Request failed or timed out"; }
    results.push({ check: item.name, passed: Boolean(passed), reason });
  }
  return { origin: base, passed: results.every(r => r.passed), checks: results,
    limitation: "Anonymous connectivity and access only; authenticated sessions, invitation delivery, recovery and rollout are not verified." };
}

function parseArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length !== 2 || args[0] !== "--origin")
    throw Error("Usage: npm run release:smoke -- --origin https://portal.example.com");
  return { origin: exactOrigin(args[1]) };
}

if (require.main === module) {
  (async () => {
    try {
      const args = parseArgs(process.argv.slice(2));
      if (args.help) {
        console.log("Usage: npm run release:smoke -- --origin https://your-controlled-control-center-domain");
        return;
      }
      const result = await verify(args.origin);
      console.log(JSON.stringify(result, null, 2));
      if (!result.passed) process.exitCode = 1;
    } catch {
      console.error("Release smoke refused invalid or unapproved target; use --help for instructions.");
      process.exitCode = 2;
    }
  })();
}

module.exports = { exactOrigin, verify, parseArgs, checks };
