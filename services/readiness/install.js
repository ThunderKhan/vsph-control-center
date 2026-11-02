const fs = require("node:fs"),
  path = require("node:path");
const { verifyManifest, tables, signatures } = require("./database");
const { installationEntries, sourceMarker } = require("./history");
const root = path.resolve(__dirname, "../..");
const literal = (s) => "'" + String(s).replaceAll("'", "''") + "'";
function buildInstall({ mode, projectRef }) {
  if (!["legacy", "fresh"].includes(mode) || !/^[a-z0-9]{20}$/.test(projectRef))
    throw Error("Explicit install mode and public project reference required.");
  const checked = verifyManifest();
  if (checked.errors.length)
    throw Error("Migration manifest failed verification.");
  const entries = installationEntries(checked.manifest);
  const snapshot = JSON.parse(
    fs.readFileSync(
      path.join(root, "docs/operations/preflight/legacy-catalog-20261101.json"),
      "utf8",
    ),
  );
  const catalog = fs
    .readFileSync(
      path.join(root, "services/readiness/legacy-catalog.sql"),
      "utf8",
    )
    .trim()
    .replace(/;$/, "");
  const guard =
    mode === "fresh"
      ? `if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f')) or exists(select 1 from auth.users) then raise exception 'Fresh install refuses an occupied database';end if;`
      : `if (select schema_snapshot from (${catalog}) captured) is distinct from ${literal(JSON.stringify(snapshot))}::jsonb then raise exception 'Legacy catalog drift: operator review required';end if;`;
  const chunks = [
    `-- VSPH reviewed installation package. Intended project: ${projectRef}; mode: ${mode}.
-- SQL cannot prove a hosted project reference. Operator must verify the connection.
-- Requires approved target, private verified backup/recovery, and maintenance window.
-- Do not run against the existing candidate until those gates pass.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(867530901);
do $vsph_guard$ begin
 if to_regclass('auth.users') is null then raise exception 'Supabase Auth foundation required';end if;
 if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role'))<>3 then raise exception 'Supabase roles required';end if;
 if to_regnamespace('supabase_migrations') is not null then raise exception 'Existing migration namespace requires explicit reconciliation';end if;
 ${guard}
end $vsph_guard$;`,
  ];
  if (mode === "legacy") {
    chunks.push(
      "lock table " +
        snapshot.tables.map((t) => 'public."' + t.name + '"').join(",") +
        " in share row exclusive mode;",
    );
    chunks.push(`do $vsph_recheck$ begin ${guard} end $vsph_recheck$;`);
  }
  chunks.push(`create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
alter table supabase_migrations.schema_migrations enable row level security;
revoke all on schema supabase_migrations from public,anon,authenticated;
revoke all on supabase_migrations.schema_migrations from public,anon,authenticated;`);
  for (const e of entries) {
    const sql = fs.readFileSync(path.join(root, e.path), "utf8");
    if (!e.baseline || mode === "fresh") chunks.push(sql);
    const statements =
      e.baseline && mode === "legacy"
        ? [
            sourceMarker(e),
            "-- Existing baseline verified; bootstrap and product seeds NOT replayed.",
          ]
        : [sourceMarker(e), sql];
    chunks.push(
      `insert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(e.version)},${literal(e.name)},array[${statements.map(literal).join(",")}]);`,
    );
  }
  chunks.push(`do $vsph_check$ declare t text;s text;r text;begin
 foreach t in array array[${tables.map(literal).join(",")}] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t and c.relrowsecurity) then raise exception 'Missing or unsafe application table';end if;
  foreach r in array array['anon','authenticated'] loop
   if has_table_privilege(r,to_regclass('public.'||t),'SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege(r,to_regclass('public.'||t),'SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'Browser table privilege is unsafe';end if;
  end loop;
 end loop;
 foreach s in array array[${signatures.map(literal).join(",")}] loop
  if to_regprocedure(s) is null then raise exception 'Required function missing';end if;
  if has_function_privilege('anon',to_regprocedure(s),'EXECUTE') or has_function_privilege('authenticated',to_regprocedure(s),'EXECUTE') or not has_function_privilege('service_role',to_regprocedure(s),'EXECUTE') then raise exception 'Function grants are unsafe';end if;
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='applications' and column_name='visibility') then raise exception 'Product visibility missing';end if;
end $vsph_check$;
notify pgrst,'reload schema';
commit;`);
  return { sql: chunks.join("\n\n") + "\n", entries, mode, projectRef };
}
module.exports = { buildInstall };
