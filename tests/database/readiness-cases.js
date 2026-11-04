const assert = require("node:assert/strict");
const {
  inspectDatabase,
  assess,
  verifyManifest,
} = require("../../services/readiness/database");
module.exports = async (pool) => {
  const client = await pool.connect();
  try {
    const before = (await client.query("select count(*) from profiles")).rows[0]
      .count;
    const snapshot = await inspectDatabase(client);
    const result = assess(snapshot, verifyManifest().manifest);
    assert.equal(
      result.catalogChecksPassed,
      true,
      JSON.stringify(result.blockers),
    );
    assert.equal(result.historyReconciled, false);
    assert.equal(result.releaseReady, false);
    assert.ok(result.blockers.includes("migration_history_missing"));
    assert.equal(
      (await client.query("select count(*) from profiles")).rows[0].count,
      before,
    );
    await client.query(
      "alter table public.crm_contacts disable row level security",
    );
    try {
      const broken = assess(
        await inspectDatabase(client),
        verifyManifest().manifest,
      );
      assert.ok(broken.blockers.includes("rls_disabled:crm_contacts"));
    } finally {
      await client.query(
        "alter table public.crm_contacts enable row level security",
      );
    }
    await client.query("grant select on public.music_requests to anon");
    try {
      const broken = assess(
        await inspectDatabase(client),
        verifyManifest().manifest,
      );
      assert.ok(
        broken.blockers.includes("browser_table_access:music_requests"),
      );
    } finally {
      await client.query("revoke select on public.music_requests from anon");
    }
    // This namespace is created ONLY in the already empty synthetic fixture.
    // Rehearse a valid installed canonical subset with four forward gaps.
    const {installationEntries,sourceMarker}=require('../../services/readiness/history');
    const entries=installationEntries(verifyManifest().manifest),missing=['project_work_search','internal_hr_lock_order','internal_employee_identity_links','finance_ledger','finance_exact_snapshot_report','finance_journal'];
    await client.query('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
    try {
      for(const entry of entries.filter(e=>!missing.includes(e.name)))await client.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[entry.version,entry.name,[sourceMarker(entry)]]);
      const partial=await inspectDatabase(client),assessment=assess(partial,verifyManifest().manifest);
      assert.equal(partial.history.length,entries.length-missing.length);assert.equal(assessment.canonicalHistoryRecognized,true);assert.equal(assessment.canonicalHistoryVerified,false);
      assert.deepEqual(assessment.blockers,['migration_history_incomplete']);
      assert.deepEqual(assessment.pending,entries.filter(e=>missing.includes(e.name)).map(e=>e.path));
      assert.equal((await client.query('select count(*) from supabase_migrations.schema_migrations')).rows[0].count,String(entries.length-missing.length));
      await client.query("update supabase_migrations.schema_migrations set statements=array['tampered'] where version=$1",[entries[1].version]);
      const drift=assess(await inspectDatabase(client),verifyManifest().manifest);
      assert.ok(drift.blockers.includes('migration_history_source_marker_mismatch'));assert.equal(drift.historyReconciled,false);
    } finally { await client.query('drop schema supabase_migrations cascade'); }
    await client.query("begin read only");
    try {
      await assert.rejects(
        client.query(
          "insert into organizations(name,slug) values ('Must not write','readonly-inspection-forbidden')",
        ),
        { code: "25006" },
      );
    } finally {
      await client.query("rollback");
    }
  } finally {
    client.release();
  }
};
