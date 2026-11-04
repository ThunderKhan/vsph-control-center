# HRMS and personal-profile installation — 4 November 2026

The existing configured Supabase project `zbmerhexucqxazuxjmmw` now has the personal-profile and internal HRMS schema. This is the existing, potentially live target, not an isolated staging environment. No new project, branch, paid service, production app deployment or external provider connection was created.

## Installed source and receipt

| Canonical version | Source migration              |
| ----------------- | ----------------------------- |
| `20261104091848`  | `account_profile_preferences` |
| `20261104093317`  | `internal_hrms_self_service`  |

Installation receipt: `20261104103649`, name `vsph_hrms_profiles_20261104`, full SQL SHA-256 `af28c4185c0100d502b9753037d85e24dd3379ee65a9dba79f58715e256e97a1`. The actual hosted receipt digest matches the generated reviewed package. History has 29 rows: 27 canonical source entries and two separately verified installation receipts. No old row was deleted, renamed or repaired. Bootstrap, legacy installer and seeds were not rerun.

The first attempt stopped with SQL syntax error `42601` in the forward history guard because an earlier receipt contained the guard's dollar delimiter. Read-only checks confirmed the new tables remained absent and history stayed at 26 rows. The corrected generator compares SHA-256 hashes of full receipt/marker text instead of embedding executable SQL. Its existing canonical/registered-receipt validation, table lock, advisory lock, timeouts and transactional migration ordering remain intact. Native tests cover nested delimiters, matching text, tampering, unknown-receipt rejection, concurrent upgrades and late-failure rollback. The reviewed retry installed both pending migrations in order and notified PostgREST to reload its schema.

## Preservation and permission evidence

Read-only before/after row counts and full-row aggregate fingerprints match for 12 existing tables: profiles, organizations, subscriptions, CRM contacts, Music requests, internal employees, organization memberships, organization product access, user product roles, application sessions, portal sessions and applications. Six Auth users remain; no Auth identity or credential was modified. No real invitation/email was sent.

All three new tables start empty: profile preferences, leave requests and attendance. No fixture or sample workforce records were inserted into the hosted target. The existing target had zero projects, accepted employee links and HR grants before installation.

All 46 required public tables have RLS enabled and deny direct browser table/column access. All 31 required privileged functions exist, use security definer with an empty fixed search path, deny anonymous/authenticated execution and allow the server service role. Both private HRMS helpers also deny service-role direct execution. The required session public ID and application visibility columns exist. The readiness assessor, using the actual read-only catalog and exact receipt history, reports no catalog/history blockers and no pending source migrations. Its broader release-ready result remains false: catalog evidence does not prove Auth/PostgREST or full release acceptance.

## Verification boundary and remaining work

Code for profiles and HRMS is merged in PRs [#70](https://github.com/ThunderKhan/vsph-control-center/pull/70) and [#71](https://github.com/ThunderKhan/vsph-control-center/pull/71). The generator correction, acceptance-harness cleanup and receipt documentation are tracked separately. Refer to `docs/roadmap/IMPLEMENTATION_REPORT.md` for exact merge SHAs and final CI results.

Native PostgreSQL tests, authenticated Chromium fixtures, provider-failure simulations and full synthetic database restore rehearsal are isolated evidence. They do not prove a restore of this hosted database, live employee password/MFA consent, real email delivery, a production deployment, or an end-to-end live PostgREST login. Those acceptance gates remain separate. Existing provider-managed event-trigger execution grants and leaked-password-protection warnings remain for approved remediation. The six moderate development-dependency findings are unchanged.

Existing-account consent remains mandatory before employee self-service or new HR appointments. Owner-only `/hr/access`, HR `/hr`, employee `/my-work` and own `/account/profile` are documented in [HRMS workspaces](HRMS_WORKSPACES.md). Ordinary customer identities gain no internal HR authority. Explicit project managers retain their assigned project powers; ordinary consent-linked employees use only their own assigned work. Do not infer customer product roles from HR/owner status.

Payroll, statutory calculations, leave accrual/balances, shift policies, attendance hardware verification, new-identity employee Auth invitations and performance reviews are not completed by this release. Presence records are self-reported and are not approved paid hours.

If an application rollback is needed, retain the new tables/history and deploy a reviewed forward repair. Do not reset, seed, delete records, or restore weaker project visibility to make an old UI work. No hosted disaster-recovery completion is claimed.

The post-install security advisor reports no ERROR findings. Its three existing WARN categories concern [anonymous execution of the provider event trigger](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated execution of the same trigger](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No hosted Auth configuration or provider-owned grant was changed. The RLS-without-policy INFO notices reflect deliberate browser denial in this server-RPC architecture; native tests and hosted grants verify that boundary. Machine-readable aggregate evidence is in `preflight/hrms-install-verification-20261104.json`; it contains no user records or credentials.
