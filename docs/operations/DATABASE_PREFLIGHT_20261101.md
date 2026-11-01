# Database preflight and authorization plan — 1 November 2026

Target inspected read-only: zbmerhexucqxazuxjmmw (vsph-supabase), PostgreSQL 17.11.0.003, eu-west-1. Entry repository main e928bc0e6a498abdf8c4e70a19142442f8f0e1b9. This document is a proposed plan, not authorization or a record of installed SQL. The user's explicit instruction is to leave this candidate unchanged. No hosted DDL/DML, resets, seeds, Auth changes, exports or resource creation occurred.

## Existing data and integrity

Counts are point-in-time inventories, not proof of production/test classification. No customer record values, names, emails, tokens, password hashes or keys were retrieved.

| Data                                                           |               Observed rows |
| -------------------------------------------------------------- | --------------------------: |
| Auth identities / public profiles                              |                       6 / 6 |
| Organizations                                                  |              6 (all active) |
| Memberships                                                    |     6 (5 active, 1 invited) |
| Applications / product role definitions                        |                      2 / 10 |
| Subscriptions / organization grants / individual product roles |                   8 / 8 / 8 |
| Portal sessions / product sessions                             |                       5 / 1 |
| Unexpired portal / product session rows at integrity read      |                       1 / 1 |
| Supabase Auth session rows                                     | 12 (not claimed all active) |
| Audit events                                                   |                           1 |
| CRM contacts / Music requests                                  |                       4 / 3 |
| Storage buckets / objects                                      |                       0 / 0 |

All six profiles are active; CRM and Music are active. Eight subscriptions are flagged active, with no observed expired/future/inverted terms; eight grants are enabled. No normalized-email duplicates/non-normalized emails, noncanonical login paths or unvalidated public constraints were observed. These checks do not prove business ownership or authorize deletion.

The catalog has 13 public tables, all RLS-enabled, 50 constraints and 23 indexes. Browser anon/authenticated table/column grants are absent. Captured metadata is in preflight/legacy-catalog-20261101.json. Native tests compare its columns/defaults/nullability/RLS/FKs/checks/indexes to historical schema.sql before running populated upgrades; no hosted row data is imported. PostgreSQL 18 not-null constraint catalog entries are excluded from the constraint comparison because nullability is compared directly on columns.

No migration ledger exists and list_migrations returns empty. That is not proof no historical SQL was ever run. There are no application RPCs other than the provider event-trigger function: the 12 required runtime functions, 22 later public tables, applications.visibility, portal_sessions.public_id and membership/organization version columns are absent. The missing visibility filter explains /api/apps failures if the Windows server uses this project. Customer/project RPC absence explains those corresponding routes.

## Binding and possible production dependencies

The Work checkout has no configured application Supabase URL/keys. It is not the Windows machine at D:\Projects\vsph-control-center and cannot read that machine's .env or process environment. Its supplied console output does not identify the project. Therefore Windows binding remains UNVERIFIED, not confirmed by a matching error symptom.

After pulling the diagnostic PR, run locally from the repository:

```powershell
npm run config:inspect -- zbmerhexucqxazuxjmmw
```

This loads .env with the same precedence as server.js (existing process variables win), prints only public host/project reference and credential presence flags, and performs no network/database call. It deliberately reports connectionVerified=false. matchesExpectedProject=true confirms the effective project reference for that command, not the environment classification or a running process started with different settings. Run from the same shell/environment used to start npm run dev; restart only as an intentional local action. Share only that redacted output, never .env or keys. Exit 1 means missing/mismatched/invalid configuration, not a failed migration.

The database is potentially live: nonempty business tables and unexpired session rows exist. Active connections include managed client/background processes; connection counts alone cannot identify production consumers. No public table triggers, public Realtime publication members, replication slots, cron.job catalog or database webhook catalog were observed. Managed platform event triggers (including ensure_rls and PostgREST watchers) exist and must be preserved. pgcrypto is already in extensions, not public; the historical fixture warning is not this hosted extension layout. Vault values and SQL query text/client IPs were not read.

Connected GitHub code search found this reference only in the primary repository's two operational documents; none in the Music repository. No Vercel Git-bound project matched either repository in the accessible account. The previously inspected vsph deployment is CLI Next.js without reported Git binding. These negative searches do not exclude CLI deployments, company accounts, other services, private environment variables, outside applications, scheduled jobs or unobserved consumers. Backend owner and actual environment classification remain required.

## Ordered missing migration set

Bootstrap policy: VERIFY ONLY on this existing candidate. Replaying schema.sql could overwrite existing CRM/Music names/login paths through its ON CONFLICT UPDATE; it is not an approved upgrade. Preserve all existing IDs and row values.

The checked manifest contains the full file SHA-256 hashes. Each row below requires the previous row plus the verified core schema; original file contents remain unchanged.

| Order | Source migration                                   | Required changes / evidence absent                                                                                       |
| ----: | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
|     1 | 20261030_music_sso_launch_codes.sql                | SSO-code table/index and service-only consume function                                                                   |
|     2 | 20261030_music_staff_musician_roles.sql            | Expand role check and add two Music role definitions; do not assign any user new roles                                   |
|     3 | 20261031000100_atomic_profile_status.sql           | Atomic account-status/session/audit function                                                                             |
|     4 | 20261031000200_durable_provisioning.sql            | Provisioning jobs, invitation/outbox tables and transaction function                                                     |
|     5 | 20261031000300_projects.sql                        | Independent Projects tables, constraints, indexes and authorization/command functions                                    |
|     6 | 20261031000400_invitation_disable_revocation.sql   | Replace account/provisioning functions with disable/replay/lock safeguards                                               |
|     7 | 20261031000500_project_delivery.sql                | Scoped GitHub installation/repository/observation/event/link/webhook persistence/functions                               |
|     8 | 20261031000600_project_notifications.sql           | Notification preferences/outbox/inbox, capture triggers and reporting functions                                          |
|     9 | 20261031000700_self_service_sessions.sql           | Add unique public UUIDs to existing portal sessions, retain hashes/expiry/user IDs; session governance function          |
|    10 | 20261031065919_overdue_milestone_notifications.sql | Due-work indexes and forward notification function                                                                       |
|    11 | 20261101052745_member_governance.sql               | Membership version=1; account-block flag, live-invite uniqueness, new customer function and secure invitation extensions |
|    12 | 20261101053314_product_registry.sql                | Product metadata/version/visibility defaults, expanded lifecycle constraint, health table and product function           |
|    13 | 20261101054139_customer_lifecycle.sql              | Organization version=1, product-session index/guard trigger, lifecycle function and directory paging                     |

Specific preservation review: no auth.users migration writes or profile/platform-role/membership/subscription/grant reassignment is requested by this installation. Existing 6 memberships gain version=1; 6 organizations gain version=1; 5 portal session rows gain new public UUID identifiers. Existing two applications gain version=1, listed visibility, adapter mode, empty description and nullable ownership/support/docs fields. Replace applications_status_check inside a transaction, retaining all current allowed states and adding disabled. Two new Music role DEFINITIONS are added, not user assignments. Member account-block backfill affects only revoked invitations on disabled profiles; this target currently has no invitation table/rows. New runtime functions contain revocation/deletion branches but must NOT be invoked as installation steps.

The existing invited membership is preserved as invited. It has no new purpose-bound invitation/job: installation must not silently activate it or invent a sent email. Legacy link reconciliation/reissue is a separate reviewed identity action; the new begin_member rejects overwriting an existing membership. This is a concrete outstanding recovery requirement, not seamless legacy-link compatibility.

## Historical version collision — explicit proposed reconciliation

Both Music filenames use version 20261030, which cannot represent two independent entries in a standard version-keyed ledger. Do not silently rename originals, run db push from this folder, or mark nonexistent objects installed.

Proposed for separate review: prepare a target-specific canonical installation workspace, copying the EXACT two source files under unique ledger versions 20261030000100 and 20261030000200; keep later versions unchanged. Preserve original-path → canonical-version → source-checksum mapping as an installation artifact. Adopt the existing core only after catalog equivalence is proven, recording a verify-only baseline marker rather than replaying bootstrap. Inspect the approved target's ledger immediately beforehand and abort on version conflict. This namespace/ledger adoption requires explicit approval and reviewed tooling; it has NOT been installed or automatically repaired. The current generic readiness inspector continues to fail closed on the original collision until that target-specific mapping is implemented and verified.

## Backup and recovery gates (not executed)

The owning Supabase organization reports Free. Do not assume paid daily-backup/PITR retention. Current backup availability, last successful snapshot, downloadable backup completeness and restore point were NOT verified: the installed connector exposes no database-backup listing/restore tool and Work has no database/Management API credentials. No plan upgrade or credentials were requested/changed.

Before approving any installation on the existing candidate:

1. Identify all consumers/writers and environment ownership. Approve a maintenance window and quiesce relevant app/invitation/GitHub/notification writers. Capture a consistent pre-change state after quiescence, not counts taken during unrelated live traffic.
2. Verify an actual recoverable provider backup/restore capability OR a provider-supported complete export and rehearsed recovery path. Preserve public data/schema, Auth identities/password state, role/grant definitions, session/subscription/permission rows and platform configuration. A public-only dump is insufficient. Never copy Auth hashes, session material or customer records into Git, chat or CI.
3. Obtain any required connection/Management API access through an approved secret manager/local configuration. Keep backup files encrypted/private with checksums, owner, timestamp, source project/version and access controls. Confirm the actual export includes auth.users and required Auth state; default CLI filters/managed schemas must not be assumed complete. Use the official Supabase backup/restore procedure for the target type; raw full pg_dump restoration into a managed project can fail on provider-owned roles/schemas.
4. Separately protect Auth/project settings, signing/key material, redirect/SMTP/provider configuration and any external object data. Supabase database backups do not contain Storage object files or custom role passwords. Storage is empty at this observation, but recheck before change. Do not rotate credentials as part of migration.
5. Restore the approved backup into a genuinely isolated compatible Supabase target and verify user IDs, sign-in, row fingerprints/counts, memberships/grants/roles/subscription dates, RLS/grants, sessions and external dependency behavior. A successful archive listing or synthetic CI restore is not hosted restoration proof. Measure recovery duration/data-loss window; do not invent RPO/RTO.
6. Rehearse all reviewed files in dependency order with bounded lock/statement timeouts. Use transaction boundaries with error-stop and durable checksum/version records; never blindly rerun a partially committed batch. Abort for catalog drift, conflicting history, invalid constraints, duplicate live invitations, unexpected users/permission changes or preservation mismatches.
7. Validate Auth/PostgREST service RPC access and browser-role denial, real staged login, existing product access and Projects/customer workflows. Keep SMTP and external side effects disabled until separately approved test targets exist. Verify PostgREST schema-cache visibility before routing the updated backend.
8. On statement failure, roll back its uncommitted transaction. If earlier migrations committed, pause rollout and use a reviewed forward repair with exact installed-state evidence. Do not drop feature tables or reverse column/permission changes blindly. Full project restore is a separate explicitly approved destructive recovery operation: quiesce, account for post-backup writes, restore through the rehearsed provider path, verify Auth/data/access, then resume. No full restore is authorized by this plan.

Official references: [Database backups](https://supabase.com/docs/guides/platform/backups), [platform-to-self-hosted restore and CLI filtering](https://supabase.com/docs/guides/self-hosting/restore-from-platform). No dump/reset/push/restore command was run against the hosted project. Local CLI dump help was inspected only.

## Staging availability and exact authorization decisions

No approved isolated VSPH project/branch was found. The accessible VSPH candidate has no branches; the other two projects are unrelated and inactive and must not be repurposed. The existing disposable local/CI databases remain available for synthetic testing, not real Auth/PostgREST or hosted backup proof.

Required decisions, in order:

1. Confirm Windows binding using the redacted command and identify the actual backend/deployment/database owner. Classify this populated project; it is not assumed disposable.
2. Designate an existing approved isolated target, or confirm which organization should receive a staging cost/eligibility quote. The cost tool requires user organization selection; no price is assumed and no resource is created. Approve any quoted project/branch/plan cost before provisioning. Schema-only/synthetic staging must use separate identities/keys and disabled real delivery; copying customer/Auth data needs its own approval.
3. Approve and verify the backup/export/recovery path and maintenance window. Current backup status is a blocker, especially on Free.
4. Only then authorize the reviewed canonical history adoption and ordered SQL installation on an EXACT project reference. Authorization for staging must not be treated as authorization for the existing candidate or production. Approve legacy invited-member recovery separately if needed. Production release and destructive restore remain separate decisions.

Independent code changes in this preflight PR add credential-redacted config inspection and fail-closed SCHEMA_NOT_READY/503 diagnostics instead of generic 500s; they do not bypass visibility, fake missing data or install SQL. Native tests compare the captured core metadata and exercise the actual missing-column HTTP path in an isolated database. The report is a preflight and proposal, not a guarantee of data preservation without the above evidence and approval.
