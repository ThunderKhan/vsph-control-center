const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const { installationEntries, sourceMarker } = require("./history");
function verifyManifest(
  manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "supabase/migration-manifest.json"),
      "utf8",
    ),
  ),
) {
  const errors = [],
    seen = new Set();
  for (const entry of [manifest.bootstrap, ...manifest.migrations]) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      !/^supabase\/(schema\.sql|migrations\/[a-zA-Z0-9_]+\.sql)$/.test(
        entry.path,
      ) ||
      seen.has(entry.path)
    )
      throw Error("Invalid migration manifest.");
    seen.add(entry.path);
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, entry.path)))
      .digest("hex");
    if (digest !== entry.sha256) errors.push("checksum:" + entry.path);
  }
  const actual = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => "supabase/migrations/" + f);
  for (const file of actual)
    if (!seen.has(file)) errors.push("unregistered:" + file);
  for (let i = 0; i < manifest.migrations.length; i++)
    for (const dependency of manifest.migrations[i].requires || [])
      if (!manifest.migrations.slice(0, i).some((e) => e.path === dependency))
        errors.push("dependency:" + manifest.migrations[i].path);
  return { manifest, errors };
}
const tables = [
  "product_health_observations",
  "profiles",
  "organizations",
  "organization_memberships",
  "applications",
  "app_roles",
  "subscriptions",
  "organization_app_access",
  "user_app_roles",
  "portal_sessions",
  "app_sessions",
  "audit_logs",
  "crm_contacts",
  "music_requests",
  "sso_launch_codes",
  "provisioning_jobs",
  "membership_invitations",
  "invitation_outbox",
  "projects",
  "project_memberships",
  "project_products",
  "project_milestones",
  "project_tasks",
  "project_comments",
  "project_deliverables",
  "project_activity",
  "project_github_installations",
  "project_repositories",
  "project_delivery_records",
  "project_delivery_events",
  "project_delivery_links",
  "github_webhook_receipts",
  "project_notification_preferences",
  "project_notification_outbox",
  "project_notifications",
];
const signatures = [
  "public.consume_sso_launch_code(text)",
  "public.set_profile_status(uuid,uuid,text)",
  "public.provisioning_command(uuid,text,uuid,jsonb)",
  "public.project_command(uuid,text,uuid,jsonb)",
  "public.delivery_command(uuid,text,uuid,jsonb)",
  "public.notification_command(uuid,text,uuid,jsonb)",
  "public.project_report(uuid,text,uuid,jsonb)",
  "public.session_command(uuid,text,uuid,jsonb)",
  "public.customer_command(uuid,text,uuid,jsonb)",
  "public.product_command(uuid,text,uuid,jsonb)",
  "public.customer_lifecycle(uuid,text,uuid,jsonb)",
  "public.guard_product_session_organization()",
];
async function inspectDatabase(client) {
  await client.query("begin read only");
  try {
    await client.query(
      "set local statement_timeout='10s';set local lock_timeout='2s';set local idle_in_transaction_session_timeout='30s'",
    );
    const roles = (
      await client.query(
        "select rolname from pg_roles where rolname=any($1::text[])",
        [["anon", "authenticated", "service_role"]],
      )
    ).rows.map((r) => r.rolname);
    const found = (
      await client.query(
        "select c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any($1::text[])",
        [tables],
      )
    ).rows;
    for (const table of found) {
      table.browserAccess = false;
      for (const role of ["anon", "authenticated"].filter((r) =>
        roles.includes(r),
      )) {
        const result = await client.query(
          "select has_table_privilege($1,to_regclass($2),'SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege($1,to_regclass($2),'SELECT,INSERT,UPDATE,REFERENCES') allowed",
          [role, "public." + table.name],
        );
        table.browserAccess ||= result.rows[0].allowed;
      }
    }
    const functions = [];
    for (const signature of signatures) {
      const row = (
        await client.query(
          "select p.prosecdef definer,p.proconfig config,md5(pg_get_functiondef(p.oid)) definition_hash from pg_proc p where p.oid=to_regprocedure($1)",
          [signature],
        )
      ).rows[0];
      if (!row) {
        functions.push({ signature, exists: false });
        continue;
      }
      const info = {
        signature,
        exists: true,
        definer: row.definer,
        fixedSearchPath: (row.config || []).some((v) =>
          /^search_path=(""|)$/.test(v),
        ),
        definitionHash: row.definition_hash,
        browserExecute: false,
        serviceExecute: false,
      };
      for (const role of roles) {
        const granted = (
          await client.query(
            "select has_function_privilege($1,to_regprocedure($2),'EXECUTE') allowed",
            [role, signature],
          )
        ).rows[0].allowed;
        if (role === "service_role") info.serviceExecute = granted;
        else info.browserExecute ||= granted;
      }
      functions.push(info);
    }
    const historyExists = (
      await client.query(
        "select to_regclass('supabase_migrations.schema_migrations') is not null present",
      )
    ).rows[0].present;
    let history = [];
    if (historyExists) {
      const cols = (
        await client.query(
          "select column_name from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations' and column_name in ('version','name','statements')",
        )
      ).rows.map((x) => x.column_name);
      if (cols.includes("version") && cols.includes("name"))
        history = (
          await client.query(
            "select version::text,name," +
              (cols.includes("statements") ? "statements[1]" : "null::text") +
              " source_marker from supabase_migrations.schema_migrations order by version limit 1000",
          )
        ).rows;
    }
    const sessionId = (
      await client.query(
        "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='portal_sessions' and column_name='public_id' and is_nullable='NO' and data_type='uuid') present",
      )
    ).rows[0].present;
    const productVisibility = (
      await client.query(
        "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='applications' and column_name='visibility' and data_type='text' and is_nullable='NO') present",
      )
    ).rows[0].present;
    await client.query("rollback");
    return {
      productVisibility,
      roles,
      tables: found,
      functions,
      historyExists,
      history,
      sessionPublicId: sessionId,
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}
function assess(snapshot, manifest) {
  const blockers = [];
  for (const role of ["anon", "authenticated", "service_role"])
    if (!snapshot.roles.includes(role)) blockers.push("missing_role:" + role);
  for (const table of tables) {
    const found = snapshot.tables.find((t) => t.name === table);
    if (!found) blockers.push("missing_table:" + table);
    else {
      if (!found.rls) blockers.push("rls_disabled:" + table);
      if (found.browserAccess) blockers.push("browser_table_access:" + table);
    }
  }
  for (const signature of signatures) {
    const found = snapshot.functions.find((f) => f.signature === signature);
    if (!found?.exists) blockers.push("missing_function:" + signature);
    else {
      if (!found.definer || !found.fixedSearchPath)
        blockers.push("unsafe_function:" + signature);
      if (found.browserExecute || !found.serviceExecute)
        blockers.push("function_grants:" + signature);
    }
  }
  if (!snapshot.productVisibility)
    blockers.push("application_visibility_missing");
  if (!snapshot.sessionPublicId) blockers.push("session_public_id_missing");
  if (!snapshot.historyExists) blockers.push("migration_history_missing");
  const canonical = installationEntries(manifest);
  const canonicalHistoryVerified =
    snapshot.historyExists &&
    snapshot.history.length === canonical.length &&
    canonical.every((e) =>
      snapshot.history.some(
        (h) =>
          h.version === e.version &&
          h.name === e.name &&
          h.source_marker === sourceMarker(e),
      ),
    );
  const expected = canonicalHistoryVerified ? canonical : manifest.migrations;
  const versions = expected.map((m) => m.version);
  if (new Set(versions).size !== versions.length)
    blockers.push("legacy_version_collision_requires_reconciliation");
  const pending = expected
    .filter(
      (m) =>
        !snapshot.history.some(
          (h) => h.version === m.version && h.name === m.name,
        ),
    )
    .map((m) => m.path);
  if (pending.length) blockers.push("migration_history_incomplete");
  const known = new Set(versions);
  if (snapshot.history.some((h) => !known.has(h.version)))
    blockers.push("unrecognized_migration_history");
  return {
    catalogChecksPassed: !blockers.some(
      (b) => !b.includes("history") && !b.includes("reconciliation"),
    ),
    canonicalHistoryVerified,
    historyReconciled: !blockers.some(
      (b) => b.includes("history") || b.includes("reconciliation"),
    ),
    releaseReady: false,
    blockers,
    pending,
    limits: [
      "Catalog checks do not prove full schema equivalence or Auth/PostgREST behavior.",
      "No backup, restore, migration application or deployment is performed.",
    ],
  };
}
module.exports = {
  verifyManifest,
  inspectDatabase,
  assess,
  tables,
  signatures,
};
