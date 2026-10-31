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
