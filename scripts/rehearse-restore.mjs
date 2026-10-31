// Disposable GitHub CI service only. Never reads a hosted/staging database variable.
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import pg from "pg";
import database from "../services/readiness/database.js";
export function target(env) {
  const u = new URL(env.TEST_DATABASE_URL || "http://missing.invalid");
  if (
    env.CI !== "true" ||
    env.VSPH_RESTORE_REHEARSAL !== "true" ||
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    !["localhost", "127.0.0.1"].includes(u.hostname) ||
    u.pathname !== "/vsph_test" ||
    u.username !== "postgres" ||
    u.port !== "5432" ||
    u.search ||
    !/^[a-f0-9]{64}$/.test(env.VSPH_CI_POSTGRES_CONTAINER || "")
  )
    throw Error("Only an explicit isolated CI PostgreSQL service is allowed.");
  return { url: u, container: env.VSPH_CI_POSTGRES_CONTAINER };
}
function docker(args, stdio) {
  const r = spawnSync("docker", args, {
    stdio,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  if (r.error || r.status !== 0)
    throw Error("Disposable restore command failed.");
  return r.stdout?.trim();
}
async function snapshot(pool) {
  const c = await pool.connect();
  try {
    await c.query("begin read only");
    await c.query("set local statement_timeout='10s';set local timezone='UTC'");
    const list = (
      await c.query(
        "select schemaname,tablename from pg_tables where schemaname='public' or (schemaname='auth' and tablename='users') order by schemaname,tablename",
      )
    ).rows;
    const tables = [];
    for (const item of list) {
      if (
        !/^[a-z_]+$/.test(item.schemaname) ||
        !/^[a-z_]+$/.test(item.tablename)
      )
        throw Error("Unexpected fixture identifier");
      const r = await c.query(
        "select count(*)::integer rows,md5(coalesce(string_agg(row_data::text,chr(10) order by row_data::text),'')) digest from (select to_jsonb(t) row_data from \"" +
          item.schemaname +
          '"."' +
          item.tablename +
          '" t) x',
      );
      tables.push({ ...item, ...r.rows[0] });
    }
    const constraints = (
      await c.query(
        "select n.nspname,c.relname,x.conname,pg_get_constraintdef(x.oid) definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,x.conname",
      )
    ).rows;
    const sequences = (
      await c.query(
        "select schemaname,sequencename,start_value,min_value,max_value,increment_by,cycle,last_value from pg_sequences where schemaname='public' order by sequencename",
      )
    ).rows;
    await c.query("rollback");
    const catalog = await database.inspectDatabase(c);
    return { tables, constraints, sequences, catalog };
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
export async function main(env = process.env) {
  const { url, container } = target(env);
  const image = docker(
    ["inspect", "--format", "{{.Config.Image}}", container],
    ["ignore", "pipe", "pipe"],
  );
  assert.equal(image, "postgres:17");
  const original = new pg.Pool({
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  let restored;
  const directory = await mkdtemp(join(tmpdir(), "vsph-ci-restore-"));
  try {
    const before = await snapshot(original),
      file = join(directory, "fixture.dump");
    let fd = await open(file, "wx", 0o600);
    try {
      docker(
        [
          "exec",
          container,
          "pg_dump",
          "-U",
          "postgres",
          "-Fc",
          "-d",
          "vsph_test",
        ],
        ["ignore", fd.fd, "pipe"],
      );
    } finally {
      await fd.close();
    }
    // Refuse overwrite if a restore database already exists; no drop/cleanup SQL.
    docker(
      ["exec", container, "createdb", "-U", "postgres", "vsph_restore"],
      ["ignore", "ignore", "pipe"],
    );
    fd = await open(file, "r");
    try {
      docker(
        [
          "exec",
          "-i",
          container,
          "pg_restore",
          "-U",
          "postgres",
          "--exit-on-error",
          "-d",
          "vsph_restore",
        ],
        [fd.fd, "ignore", "pipe"],
      );
    } finally {
      await fd.close();
    }
    const clone = new URL(url);
    clone.pathname = "/vsph_restore";
    restored = new pg.Pool({
      connectionString: clone.toString(),
      max: 1,
      connectionTimeoutMillis: 10000,
    });
    const after = await snapshot(restored);
    assert.deepEqual(after, before);
    console.log(
      JSON.stringify({
        scope: "disposable-ci-fixtures",
        tablesVerified: after.tables.length,
        constraintsVerified: after.constraints.length,
        sequencesVerified: after.sequences.length,
        functionsVerified: after.catalog.functions.length,
        restoreVerified: true,
        releaseReady: false,
        hostedRestoreVerified: false,
      }),
    );
  } finally {
    await original.end();
    if (restored) await restored.end();
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      JSON.stringify({
        restoreVerified: false,
        releaseReady: false,
        message:
          "Disposable CI restore rehearsal failed; no credentials or dump contents are logged.",
      }),
    );
    process.exitCode = 1;
  });
