# Hosted catalog inspection — 1 November 2026

Read-only Supabase connector inspection succeeded after installation became available in this resumed session. Earlier reports of unavailable connector methods describe the earlier execution cutoff. No hosted DDL, data writes, bootstrap, seed, migration repair, Auth changes, email or deployment was performed.

The accessible active project named vsph-supabase (reference zbmerhexucqxazuxjmmw, PostgreSQL 17.11) is a candidate existing VSPH environment, not an approved disposable staging target. Its branch inventory is empty. The other accessible projects are unrelated and inactive; they were not queried. No branch/project was created and no cost was incurred. A project name alone does not prove deployment/source binding or production ownership.

## Observed catalog

- 13 legacy public tables: profiles, organizations, organization_memberships, applications, app_roles, subscriptions, organization_app_access, user_app_roles, portal_sessions, app_sessions, audit_logs, crm_contacts and music_requests. All have RLS enabled.
- No anon/authenticated table or column grants were observed. No RLS policies on those tables is consistent with the server-owned access model; do not grant browser access simply to remove informational advisor findings.
- No supabase_migrations.schema_migrations ledger exists; list_migrations returned empty. This is not proof that no historical SQL was ever run.
- No projects, provisioning_jobs or sso_launch_codes table exists. The eight required application RPC signatures in services/readiness/database.js are absent. portal_sessions lacks public_id. Current repository backend features must not be deployed assuming these objects exist.
- Legacy column inventory matches the original core shape. Full defaults, constraints, indexes, triggers, definitions and actual deployed backend binding still require target-specific comparison before installation; this was catalog reconnaissance, not a complete equivalence or Auth/PostgREST test.

## Advisor findings and review

Hosted security advisors report two WARN findings on public.rls_auto_enable(): anon and authenticated have EXECUTE. The catalog confirms SECURITY DEFINER, search_path=pg_catalog, return type event_trigger, and enabled ensure_rls DDL event-trigger ownership. This return type constrains invocation; an advisor warning alone does not demonstrate an exploitable ordinary RPC. Review provider ownership/dependencies and revoke unnecessary browser execution through an approved target-specific change, then rerun advisors. Do not replace or remove the auto-RLS trigger blindly. [Anonymous execution remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated execution remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Hosted Auth leaked-password protection is disabled. [Review password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), plan entitlement and actual Auth configuration before an approved change. No Auth configuration was changed.

Separately, disposable CI security advisors warn that pgcrypto is installed in public by the historical repository bootstrap. This is a fixture/bootstrap finding, not a claim that this extension exists in the hosted target. Review extension dependencies before relocating it; no historical checksummed SQL was rewritten. [Extension remediation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

## Exact installation gate

1. Establish the deployed server's target binding and designate an isolated staging project/branch. Creating a billable branch/project needs separate cost approval; none was created here.
2. Obtain an approved backup/export and test recovery without copying customer data into CI. The synthetic CI restore is not hosted recovery proof.
3. Compare actual constraints/defaults/indexes/triggers and core definitions with the checksummed manifest; reconcile the two Music filenames sharing version 20261030. Do not fabricate ledger entries from table names or replay bootstrap.
4. Rehearse ordered missing Music, 001–007 and 20261031065919 SQL in the approved isolated target. Record installed checksums/history, forward repair and recovery evidence. No blanket db push/reset is authorized against the existing project.
5. Test real Supabase Auth, PostgREST service-only RPC execution/browser denial, existing data preservation, invitation failure recovery and scoped Projects/GitHub UAT before separately approving a backend rollout.

Live GitHub App credentials/installation and approved Vercel project mapping remain independent gates. The ChatGPT GitHub connector's installation is not the VSPH runtime App.

Phase 4 read-only reconfirmation on 1 November still found 13 public legacy tables, no ledger/Projects/provisioning/product-health tables and absent provisioning/customer RPC. Project inventory still contains no additional active VSPH staging project and its branch inventory is empty. Phase 4 code/migrations remain unapplied there.
