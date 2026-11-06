# VSPH employee-removal migration: hosted installation (6 November 2026)

## Outcome and scope

The review-approved, additive source migration `supabase/migrations/20261106142000_employee_removal_audit.sql` was applied successfully to the existing connected Supabase project `zbmerhexucqxazuxjmmw` (`vsph-supabase`), with no new branch or cloud project. The source SHA-256 is `e00bf62828997a2e97b80714bdd233da963e824ba6011e5b0036f691a7d58f88`. The Supabase installation receipt is version `20261106163810`, name `vsph_employee_removal_audit_20261106`, with SQL SHA-256 `642e975bd4d56837c58dda5da14a792c5085a6153e827a721041ea31c4f582f3`.

The installation required the exact 35-row preinstallation canonical/receipt history digest, the verified employee-core-function definition, the existing employee-row fingerprint, and canonical temporary-credential prerequisite. It acquired the established advisory/history locks and a roster write lock, with a two-second lock timeout and sixty-second statement timeout. It executed in one explicit transaction. No bootstrap, reset, seed, employee removal, authentication change, customer change or credential change was requested.

The migration adds nullable archival columns, an immutability guard, a scoped `service_role` removal/history RPC, and an updated governed employee-core command that hides removed employees from the ordinary directory. Authorized HR managers can archive ordinary employees by supplying a reason; owners can review who removed whom, when and why. Ordinary HR cannot remove an owner or HR manager. Employee-only identity links and HR grants are revoked through existing lifecycle logic, without disabling unrelated customer/portal identities. Restoring archived employees would require a separate reviewed workflow.

## Verification

- Hosted migration history: 35 entries before, 37 afterward (new canonical version and preserved transport receipt). The source and receipt identities are pinned in the manifest and the receipt registry.
- Pre/post counts and stable full-row fingerprints of **all 17 checked data tables** matched, including `auth.users`, `profiles`, `internal_employees`, HR grants, identity links, invitations, sessions, organizations, subscriptions, CRM contacts, Music requests, and audit logs.
- Existing internal employees: **8 -> 8**. Removed employee count: **0**. Existing Auth users: **10 -> 10**. Existing audit events: **31 -> 31**. No sample identities, removal events, or private links were created.
- The three archival columns, the immutable-record trigger, and the new RPC exist. `service_role` can invoke the new RPC, while `anon` and `authenticated` cannot.
- All public application tables retain RLS, browser roles have no direct internal-employees table grants, and privileged function search paths remain fixed.
- A hosted owner-scoped read-only removal-history call succeeded and returned zero records. The local Node, PostgreSQL, desktop/mobile browser, and CI acceptance were successful before installation.
- Post-install security advisor has no new ERROR. Existing event-trigger execution warnings and leaked-password-protection warning remain; the RLS-without-policy informational category is expected for intentionally server-only tables.

## Recovery boundary

No fresh full off-site database dump or hosted restore rehearsal was performed through this connector; **the fingerprints above are not a restorable backup**. The project's earlier private dump remains historical. Avoid destructive rollback, deleting archived rows, resetting Auth users, or blindly replaying the migration. A database error before commit is transactional; a defect discovered after commit requires a reviewed forward-only repair. Keep hosted recovery readiness as a separate release gate.

The repository change and hosted database schema are persistent. This operation did **not** create or promote a production application deployment. For the existing configured local Express portal, pull main, run `npm ci`, restart `npm run dev`, and use authorized owner/HR credentials at `http://localhost:3000/login`. The disposable `npm run demo:local` is for isolated testing only. Do not remove a real employee merely to test the feature.
