# November 9, 2026 — VSPH project and onboarding migrations installed

## Exact connected target and source

- Existing Supabase project: `vsph-supabase` (`zbmerhexucqxazuxjmmw`); database `postgres`, PostgreSQL 17.11.
- Source: repository `ThunderKhan/vsph-control-center` at main `90a7ddbe889e43e30713da8c7063d0bad480f629` (all four CI jobs green).
- The reviewed migrations were installed **atomically in one bounded PostgreSQL transaction**, with an existing canonical-history gate, advisory + migration ledger locks, a two-second lock timeout, a 90-second statement timeout, checks for required/absent objects and original project function digests, post-DDL permission/shape gates, and a PostgREST schema reload notification.
- The original source files, exact source markers and existing history records were **not rewritten**. A separate Supabase apply-migration API was deliberately not used because its generated version would diverge from this repository's canonical journal.

| Canonical version | Source migration | SHA-256 |
| --- | --- | --- |
| `20261109140000` | `project_custom_applications` | `86287590060620bb2037f024a29cdb7cbc0b9bc65b573bc96b0a4906fc5c169f` |
| `20261109141500` | `organization_only_onboarding` | `82a1238d230de514aec080aad4df9438961d23f617eced17bcc3ae50a70a5c5d` |
| `20261109143000` | `project_workforce_governance` | `f6df4fd980f92292043f4db113f70fd3aad789d1259b00f76cbc73c3fa155fba` |

## Verified post-install

1. Canonical migration history grew from 41 to **44 entries**. All 44 identities, names and recorded source SHA-256 markers match the checked manifest plus known historical installation receipts. No drift, unknown row or missing canonical version.
2. **Fourteen existing tables preserved their full-row fingerprint and count**, including `auth.users` (12), `profiles` (12), `organizations` (8), `subscriptions` (9), `internal_employees` (10), `projects` (1), `project_memberships` (1), existing identity links, application roles, audit and provisioning records. No existing business/identity rows changed in the before/after sample.
3. New `project_custom_applications` has **zero rows**, RLS enabled, no direct anon/authenticated SELECT/INSERT/UPDATE grants and a service-role SELECT grant. All three new functions, plus the replaced `project_command` and `project_permission`, use security-definer with fixed empty search path and service-role-only execution.
4. A real read-only SQL invocation with the current platform-owner identity can list eligible project staff (3), project manager records (1), custom project applications (0), and returns manager/custom-app governance capability. Existing effective project-membership count remained one.
5. A denied `organization_only_onboarding` call with no current owner identity returned SQLSTATE 42501 and performed no write.
6. Source CI at `90a7ddbe` passed Node quality, native PostgreSQL isolation, browser smoke and dependency audit. These are independent from hosted post-install SQL checks.

## Explicit limitations / follow-up

- **No fresh private external backup or hosted restore rehearsal was verified in this session.** The installation's atomic SQL/early validation and preserved-row comparisons are not substitutes for a recoverable backup. An earlier user-authorized restore-rehearsal waiver for the legacy schema is not evidence of a new recovery exercise.
- No production web-service deployment or live Supabase Auth/REST/browser sign-in, customer invitation acceptance, employee task mutation or end-to-end tenant isolation test was performed against this connected database. Run these before treating the change as fully released.
- Security advisors still flag preexisting publicly executable `public.rls_auto_enable()` SECURITY DEFINER and Auth leaked-password protection as separate follow-up items. The intentional server-only RLS/no-browser-policy pattern produces INFO findings, and `project_custom_applications.created_by` has no dedicated covering FK index; investigate performance under real usage instead of silently changing checked migration bytes.
- Do not replay these source migrations, seed demo data, reset existing users, re-run bootstrap or blanket-repair historical migration versions. Future targets require their own approved migration installation and backup.
- Rollback after commit requires a reviewed forward repair or a separately validated recovery plan. Dropping tables/functions blindly is unsafe; older app deployments should remain compatible with the additive project application table and guarded function changes.

## Useful pointers

- [Reviewed source and business semantics](CUSTOM_APPLICATIONS_AND_CLIENT_ONBOARDING.md)
- [Projects permission model and acceptance guide](PROJECTS_GUIDE.md)
- [Database deployment handoff](DEPLOYMENT_HANDOFF.md)
- [Full system progress](../roadmap/PROGRESS.md)
