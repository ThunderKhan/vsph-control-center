# Functional Feedback #4 — Project archive readiness (2026-11-10)

## Diagnosis — connected VSPH target, read-only only

- **Target:** existing Supabase project `vsph-supabase` (`zbmerhexucqxazuxjmmw`), **not** a disposable test database.
- **Source:** `main` after PR #101, from which this branch was created.
- A read-only catalog query confirms **44 installed migration ledger records**. Neither `20261109193000` nor `20261109203000` is installed.
- `public.project_lifecycle_command(uuid,text,uuid,jsonb)`, `public.project_creation_command(uuid,text,jsonb)` and `public.project_workspace_command(uuid,text,uuid,jsonb)` do not exist.
- The restoration and workspace-V2 tables introduced in those migrations do not exist. The connected database contains **2 project records** at this inspection; do not assume those records are disposable.
- The existing three November 9 migrations through `20261109143000_project_workforce_governance` **are recorded as installed**.

### Read-only ledger reconciliation — checked again 2026-11-10

Compared live `supabase_migrations.schema_migrations` records against `supabase/migration-manifest.json`, including the repository's explicit historical Music-version aliases and `services/readiness/installation-receipts.json`:

- **36/36 installed canonical migrations** have the exact expected version, name and `-- vsph-source-sha256:` marker. The manifest has **38** canonical entries in total: the only two missing are lifecycle `20261109193000` and workspace V2 `20261109203000`.
- **8/8 transport receipt rows** match the registry's version/name and independently rehashed SHA-256 of their recorded SQL statement. All their required canonical source versions were present and marker-matched.
- **44 total rows**, no unrecognized versions, duplicate versions, canonical source-marker mismatch, or transport receipt digest mismatch.
- Existing `project_command`, `project_permission`, `project_workforce_command`, `project_custom_application_command` and `organization_only_onboarding` are security-definer functions with fixed empty `search_path`, service-role EXECUTE permission and **no** `anon`/`authenticated` EXECUTE permission.
- No DDL, migration, data write, archive, delete, or deployment was performed during these catalog checks.

**Scope limitation:** The current ledger identity/marker comparison and selected function-permission checks do not prove entire live schema/function-body equivalence, backup recoverability, or installation safety. The checks must be repeated inside the bounded release gate immediately before installation. An independently tested off-site backup and explicit production approval remain **required**.

The archive action calls the service-only `project_lifecycle_command`. Without that RPC, the database cannot execute archive/delete, so the UI's `Database not ready` failure is expected. The application **must not** work around this by directly updating `projects.status` or deleting records.

## Source-ready, hosted-pending migrations

- `20261109193000` — `supabase/migrations/20261109193000_feedback01_04_lifecycle.sql`, SHA-256: `f08f6871e7be8769891a85df7b039f21df819746d10272ff9ce35063046bdeac`.
- `20261109203000` — `supabase/migrations/20261109203000_project_workspace_v2.sql`, SHA-256: `dd161bdad8ea4f9958b3a96b563c791981c984f4ae403b6b18ab7ba8e00d8bc7`.

The dependency chain is **project workforce governance → lifecycle → workspace V2**. Both migrations have already passed isolated unit, native PostgreSQL and Playwright acceptance at PR #101 head `d8f82512c3ce`; this is not evidence of hosted installation or hosted backup/restore.

## Safe operator release gate — NOT authorized by this document

1. Freeze the source SHA and identify the **exact** existing Supabase project and controlled application deployment. Confirm the affected project records are real company data.
2. Obtain a fresh, encrypted **off-site database backup** including roles, schema, Auth, application data and migration history; record SHA-256. Back up Supabase Storage assets separately if in use. Restore into an **independent disposable target** and verify record inventories, permissions, RLS, object definitions and a working restore. No evidence of a fresh hosted backup/restore was available at this inspection.
3. Using read-only checks, compare **every existing canonical ledger version, name and source marker**, including the known transport receipts and historical Music aliases, with the source manifest and receipt registry. Check current `project_command`, `project_permission`, related employee triggers and direct FK dependencies. Any unrecognized identity or schema drift must block execution.
4. Have the operator review **only the two pending migration SQL files** and a target-bound forward install package. Use bounded lock/statement timeouts, a transaction and advisory/ledger locks. Revalidate both missing versions and functions under the lock. Do not rerun baseline, seed, use the original duplicate-Music-version folder with `supabase db push`, blindly `migration repair`, or mark a migration applied without executing it. Preserve all existing ledger rows.
5. **Only after explicit deployment approval**, install exactly the two reviewed migrations in order with their canonical source markers. Roll back on any verification failure. Request a PostgREST schema cache reload after commit.
6. Reinspect function definitions and service-role-only EXECUTE grants; RLS enabled with no browser-role grants on new tables; source-marker history, foreign keys, audit triggers and counts. Confirm no unrelated project/employee/customer/finance data was modified.
7. Using an approved **disposable internal test project** created by the operator, verify: owner can archive; status persists after reload; history remains; only archived **empty** projects can be deleted after explicit key confirmation; project with linked milestones/work is retained; ordinary users/HR/customers cannot archive; missing/stale version returns conflict; real manager appointment works. Do not archive the two pre-existing company projects just to test this.
8. Record rollback/forward-repair decision, recovery owner and measured restore time separately from source control. Do not call the release complete without the backup and real authenticated acceptance.

## Current implementation scope and status

- Backend now reports a specific HTTP **503** / `PROJECT_LIFECYCLE_NOT_READY` when the reviewed lifecycle RPC is missing, explicitly stating no project was changed.
- The existing owner-only project lifecycle validation, optimistic project version check, CSRF rule, retention checks and audit remain unchanged.
- **The two migrations have NOT been installed in the hosted VSPH database by this feedback work.** Archiving will remain blocked there until the operator completes the gate above. Do not represent a GitHub merge as deployment.

Reference: `docs/operations/PROJECT_NOV09_MIGRATION_INSTALL.md`, `docs/operations/RELEASE_GATES_20261109.md`, `docs/operations/FEEDBACK01_05_INTEGRATION.md`.
