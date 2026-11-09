# Project custom applications and product-free client onboarding

## User intent

Customer organizations own their customer engagements. A customer project may include multiple custom software applications while also linking reusable VSPH catalog products. A catalog product is shared by reference and only grants access through separately governed subscriptions, enabled grants and product roles. A custom project application is scoped to exactly one project and never becomes a catalog product simply by being registered.

## Delivery in source

- `/projects/:id` now has an **Applications** workspace with existing catalog product links and separate, durable custom application records.
- An explicit project manager may create or update a custom app's name, description, lifecycle, HTTPS repository/deployment links and client sharing flag, subject to project status and current membership checks.
- Application records are capped at 50 per project, individually versioned and audited. Stale updates conflict rather than overwrite data.
- A client viewer with explicit project membership and active customer organization membership can see only shared custom applications, and does not receive source repository metadata. Client access never implies project manager authority.
- Customer directory links to project creation preselected with its organization. The project API independently checks caller permissions and active organization. The URL parameter does not grant access.
- Customer onboarding may select **Custom development only**, with no product subscriptions; it uses the existing durable provisioning job, member-invitation and outbox lifecycle.

## Security and data boundaries

The project-owned custom application table has RLS enabled and no browser database grants. The service-only `project_custom_application_command(uuid,text,uuid,uuid,jsonb)` rechecks active project authority and serializes writes with project lifecycle changes; manager-only writes generate project activity and audit entries atomically. Client visibility is filtered in the database, not by hiding cards. Input is allowlisted and HTTPS links reject credentials, queries and fragments. No repository credentials are stored or fetched.

`organization_only_onboarding(uuid,uuid,jsonb)` is platform-owner-only and uses a bounded product-empty payload with UUID idempotency and the same durable invite transport. A matching retry replays the same job; a changed payload is rejected. No customer product subscription, product role, application session or payment is created.

## Installation / rollback

The two additive migrations, together with project workforce governance, **are installed on the connected existing VSPH Supabase project as of November 9, 2026**, using one canonical-history-guarded atomic transaction. The exact source entries, migration count and privileges were confirmed, and fourteen existing table fingerprints were unchanged. See [installation evidence and outstanding recovery/acceptance limits](PROJECT_NOV09_MIGRATION_INSTALL.md). This installation does **not** migrate any other target. Before deploying another environment, reconcile its history and checksums, verify a private backup and restore exercise, then install only its missing reviewed forward migrations.

If the target has not received these migrations, the custom-app API fails closed; the UI reports the dependency instead of fabricating records. Standard projects, catalog product links and existing customer onboarding remain independent. On application rollback, preserve additive tables, invitations and audit rows; fix forward after reviewing existing records. Do not drop customer data to revert UI.

## Local verification

- `npm test`, `npm run lint`, `npm run check`, `npm run check:migrations`, `npm run format:check`.
- `npm run test:db:local` verifies native PostgreSQL tenant denial, manager writes, stale-version protection, direct browser denial, client repository metadata redaction and empty-product organization provisioning.
- `npm run test:e2e:db` verifies new custom app creation and authorized reads, customer onboarding with no subscription, and organization-to-project navigation.
- Hosted Supabase Auth, real email delivery, external repository/deployment credentials, billing and production rollouts are not proven by isolated fixture tests.
