const assert = require("node:assert/strict"),
  pg = require("pg");
const { readFile } = require("node:fs/promises");
const { buildInstall } = require("../../services/readiness/install");
const {
  inspectDatabase,
  assess,
  verifyManifest,
} = require("../../services/readiness/database");
module.exports = async function (base, inputUrl) {
  const u = new URL(inputUrl);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) &&
      u.pathname === "/vsph_test",
  );
  for (const mode of ["legacy", "fresh"]) {
    const name = "vsph_install_" + mode;
    await base.query("create database " + name);
    u.pathname = "/" + name;
    const db = new pg.Pool({ connectionString: u.toString(), max: 1 }),
      c = await db.connect();
    try {
      await c.query(
        "create schema auth;create table auth.users(id uuid primary key);create schema extensions;create extension pgcrypto with schema extensions;",
      );
      if (mode === "legacy") {
        await c.query(await readFile("supabase/schema.sql", "utf8"));
        await c.query(
          "insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');insert into profiles(id,full_name,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Preserved','preserved@fixture.test');update applications set name='Preserved custom '||code;",
        );
        // Drift aborts the entire package before any history or feature object is installed.
        await c.query("alter table applications add column unexpected integer");
        await assert.rejects(
          c.query(buildInstall({ mode, projectRef: "a".repeat(20) }).sql),
          /Legacy catalog drift/,
        );
        await c.query("rollback");
        assert.equal(
          (
            await c.query(
              "select to_regclass('public.projects') p,to_regclass('supabase_migrations.schema_migrations') h",
            )
          ).rows[0].p,
          null,
        );
        await c.query("alter table applications drop column unexpected");
      } else {
        // A fresh request cannot overwrite an occupied customer database.
        await c.query(
          "insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
        );
        await assert.rejects(
          c.query(buildInstall({ mode, projectRef: "a".repeat(20) }).sql),
          /occupied database/,
        );
        await c.query("rollback");
        await c.query("delete from auth.users"); // disposable fixture only
      }
      const sql = buildInstall({ mode, projectRef: "a".repeat(20) }).sql;
      // Inject a late installation failure and prove no partial DDL/history remains.
      await assert.rejects(
        c.query(sql.replace("notify pgrst,'reload schema';", "select 1/0;")),
        { code: "22012" },
      );
      await c.query("rollback");
      assert.equal(
        (
          await c.query(
            "select to_regclass('public.projects') p,to_regclass('supabase_migrations.schema_migrations') h",
          )
        ).rows[0].h,
        null,
      );
      const concurrent = new pg.Client({ connectionString: u.toString() });
      await concurrent.connect();
      try {
        const attempts = await Promise.allSettled([
          c.query(sql),
          concurrent.query(sql),
        ]);
        await c.query("rollback");
        await concurrent.query("rollback");
        assert.equal(
          attempts.filter((a) => a.status === "fulfilled").length,
          1,
          "Only one concurrent installation may commit",
        );
        assert.match(
          attempts.find((a) => a.status === "rejected").reason.message,
          /Existing migration namespace/,
        );
      } finally {
        await concurrent.end();
      }
      const result = assess(
        await inspectDatabase(c),
        verifyManifest().manifest,
      );
      assert.equal(
        result.catalogChecksPassed,
        true,
        JSON.stringify(result.blockers),
      );
      assert.equal(
        result.historyReconciled,
        true,
        JSON.stringify(result.blockers),
      );
      assert.equal(result.releaseReady, false);
      assert.equal(
        (
          await c.query(
            "select count(*) from supabase_migrations.schema_migrations",
          )
        ).rows[0].count,
        "20",
      );
      if (mode === "legacy") {
        assert.equal(
          (
            await c.query(
              "select count(*) from profiles where email='preserved@fixture.test'",
            )
          ).rows[0].count,
          "1",
        );
        assert.ok(
          (await c.query("select name from applications")).rows.every((r) =>
            r.name.startsWith("Preserved custom "),
          ),
        );
      }
      await assert.rejects(c.query(sql), /Existing migration namespace/);
      await c.query("rollback");
      assert.equal(
        (
          await c.query(
            "select count(*) from supabase_migrations.schema_migrations",
          )
        ).rows[0].count,
        "20",
      );
    } finally {
      c.release();
      await db.end();
    }
  }
};
