const test = require("node:test"),
  assert = require("node:assert/strict");
const { buildInstall } = require("../services/readiness/install");
const {
  installationEntries,
  sourceMarker,
} = require("../services/readiness/history");
const {
  verifyManifest,
  assess,
  tables,
  signatures,
} = require("../services/readiness/database");
test("deployment package aliases history without modifying source files and preserves legacy bootstrap boundary", () => {
  const legacy = buildInstall({
      mode: "legacy",
      projectRef: "zbmerhexucqxazuxjmmw",
    }),
    fresh = buildInstall({ mode: "fresh", projectRef: "a".repeat(20) });
  assert.equal(legacy.entries.length, 23);
  assert.equal(new Set(legacy.entries.map((e) => e.version)).size, 23);
  assert.equal(legacy.entries[1].sourceVersion, "20261030");
  assert.equal(legacy.entries[1].version, "20261030000100");
  assert.match(legacy.sql, /Legacy catalog drift/);
  assert.match(legacy.sql, /Existing migration namespace/);
  assert.match(fresh.sql, /Fresh install refuses an occupied/);
  // SQL source is recorded as text in history; actual bootstrap execution only appears in fresh.
  assert.doesNotMatch(legacy.sql, /on conflict\(code\) do update/);
  assert.match(fresh.sql, /on conflict\(code\) do update/);
  assert.match(legacy.sql, /^begin;/m);
  assert.match(legacy.sql, /commit;\n$/);
  assert.match(legacy.sql, /notify pgrst/);
  assert.deepEqual(verifyManifest().errors, []);
  assert.throws(() =>
    buildInstall({ mode: "upgrade", projectRef: "a".repeat(20) }),
  );
  assert.throws(() => buildInstall({ mode: "fresh", projectRef: "bad';drop" }));
});
test("only complete canonical history with matching source markers reconciles the duplicate historical versions", () => {
  const manifest = verifyManifest().manifest,
    entries = installationEntries(manifest);
  const s = {
    roles: ["anon", "authenticated", "service_role"],
    tables: tables.map((name) => ({ name, rls: true, browserAccess: false })),
    functions: signatures.map((signature) => ({
      signature,
      exists: true,
      definer: true,
      fixedSearchPath: true,
      browserExecute: false,
      serviceExecute: true,
    })),
    historyExists: true,
    history: entries.map((e) => ({
      version: e.version,
      name: e.name,
      source_marker: sourceMarker(e),
    })),
    sessionPublicId: true,
    productVisibility: true,
  };
  assert.equal(assess(s, manifest).historyReconciled, true);
  assert.equal(assess(s, manifest).releaseReady, false);
  s.productVisibility = false;
  assert.ok(
    assess(s, manifest).blockers.includes("application_visibility_missing"),
  );
  s.productVisibility = true;
  s.history[1].source_marker = "tampered";
  assert.equal(assess(s, manifest).historyReconciled, false);
});
