const test = require("node:test"),
  assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  verifyManifest,
  assess,
  tables,
  signatures,
} = require("../services/readiness/database");
const clean = () => ({
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
  history: [],
  sessionPublicId: true,
  productVisibility: true,
});
test("manifest hashes every ordered migration and rejects drift", () => {
  const { manifest, errors } = verifyManifest();
  assert.deepEqual(errors, []);
  assert.equal(manifest.migrations.length, 32);
  const changed = structuredClone(manifest);
  changed.migrations[0].sha256 = "0".repeat(64);
  assert.ok(
    verifyManifest(changed).errors.some((e) => e.startsWith("checksum:")),
  );
});
test("legacy collision and missing ledger block readiness even with complete catalogs", () => {
  const { manifest } = verifyManifest(),
    s = clean();
  s.history = manifest.migrations.map((m) => ({
    version: m.version,
    name: m.name,
  }));
  const result = assess(s, manifest);
  assert.equal(result.catalogChecksPassed, true);
  assert.equal(result.historyReconciled, false);
  assert.equal(result.releaseReady, false);
  assert.ok(
    result.blockers.includes(
      "legacy_version_collision_requires_reconciliation",
    ),
  );
});
test("missing tables/functions, RLS and direct browser grants fail closed", () => {
  const { manifest } = verifyManifest(),
    s = clean();
  s.tables[0].browserAccess = true;
  s.tables[1].rls = false;
  s.functions[0].fixedSearchPath = false;
  s.functions[1].browserExecute = true;
  s.functions.pop();
  s.tables.pop();
  const result = assess(s, manifest);
  assert.equal(result.catalogChecksPassed, false);
  for (const prefix of [
    "browser_table_access:",
    "rls_disabled:",
    "unsafe_function:",
    "function_grants:",
    "missing_function:",
    "missing_table:",
  ])
    assert.ok(result.blockers.some((b) => b.startsWith(prefix)));
});
test("staging inspection refuses absent approval, mismatch and insecure remote TLS without logging credentials", () => {
  for (const extra of [
    {},
    {
      STAGING_INSPECTION_APPROVED: "true",
      STAGING_DATABASE_URL:
        "postgres://private:never-print@localhost/vsph_test?host=remote.example.test",
      STAGING_DATABASE_HOST: "localhost",
      STAGING_DATABASE_NAME: "vsph_test",
    },
    {
      STAGING_INSPECTION_APPROVED: "true",
      STAGING_DATABASE_URL:
        "postgres://private:never-print@localhost/vsph_test",
      STAGING_DATABASE_HOST: "wrong",
      STAGING_DATABASE_NAME: "vsph_test",
    },
    {
      STAGING_INSPECTION_APPROVED: "true",
      STAGING_DATABASE_URL:
        "postgres://private:never-print@remote.example.test/postgres?sslmode=no-verify",
      STAGING_DATABASE_HOST: "remote.example.test",
      STAGING_DATABASE_NAME: "postgres",
    },
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/staging-readiness.js"],
      {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH, ...extra },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /never-print/);
  }
});

test("CRM and Music tenant tables are mandatory security inspection targets", () => {
  const { manifest } = verifyManifest();
  for (const name of ["crm_contacts", "music_requests"]) {
    assert.ok(tables.includes(name));
    const s = clean();
    s.tables.find((t) => t.name === name).browserAccess = true;
    assert.ok(
      assess(s, manifest).blockers.includes("browser_table_access:" + name),
    );
    s.tables.find((t) => t.name === name).browserAccess = false;
    s.tables.find((t) => t.name === name).rls = false;
    assert.ok(assess(s, manifest).blockers.includes("rls_disabled:" + name));
  }
});


test("partial canonical history reports only new gaps and denies marker drift, duplicate versions and unknown identities",()=>{
 const {installationEntries,sourceMarker}=require('../services/readiness/history');
 const manifest=verifyManifest().manifest,entries=installationEntries(manifest);
 const missing=['project_work_search','internal_hr_lock_order','internal_employee_identity_links','finance_ledger','finance_exact_snapshot_report','finance_journal'];
 const s=clean();s.history=entries.filter(entry=>!missing.includes(entry.name)).map(entry=>({version:entry.version,name:entry.name,source_marker:sourceMarker(entry)}));
 const before=structuredClone(s),r=assess(s,manifest);
 assert.equal(s.history.length,entries.length-missing.length);
 assert.equal(r.canonicalHistoryRecognized,true);assert.equal(r.canonicalHistoryVerified,false);
 assert.equal(r.catalogChecksPassed,true);assert.equal(r.historyReconciled,false);assert.equal(r.releaseReady,false);
 assert.deepEqual(r.pending,entries.filter(entry=>missing.includes(entry.name)).map(entry=>entry.path));
 assert.deepEqual(r.blockers,['migration_history_incomplete']);assert.deepEqual(s,before,'Inspection must not repair or mutate the journal');
 for(const mutate of [
  value=>{value.history[1].source_marker='tampered';},
  value=>{value.history[2].name='unreviewed-name';},
  value=>{value.history.push({...value.history[3]});},
  value=>{value.history.push({version:'20990101000000',name:'unknown',source_marker:'unknown'});},
 ]){const broken=structuredClone(s);mutate(broken);const result=assess(broken,manifest);assert.equal(result.historyReconciled,false);assert.equal(result.releaseReady,false);assert.ok(result.blockers.some(b=>/source_marker|unrecognized|duplicate/.test(b)));}
});
