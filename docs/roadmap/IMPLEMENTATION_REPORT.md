## Hosted installation completed — 2 November 2026

The user explicitly authorized the existing target upgrade and waived the separate restore rehearsal after exporting a private backup. The reviewed legacy installer from a8004af23c2c669913a5f8d11f052acc4bc0350e was applied to zbmerhexucqxazuxjmmw. All 13 feature migrations plus verify-only baseline history are installed; canonical source markers match. Visibility/customer/project objects are present, 35 public tables have RLS, browser table/RPC access is denied, and key business/user aggregate counts match. Auth settings HTTP responds and real anonymous PostgREST checks deny access. No seeds, emails, new identities, credentials, paid resources or backend deployment occurred. **Hosted restore remains unverified by explicit user waiver; authenticated portal acceptance remains pending.** See [installation evidence and limitations](../operations/HOSTED_INSTALL_20261102.md). Earlier sections below describe historical cutoffs and do not supersede this installation record.

## Database deployment package — PR #39, 2 November 2026

Entry main 68ef212d5d956a85c6fc6c83ee5ef222ffb29a32 (#38). The current hosted candidate still lacks visibility/customer/project RPCs and a migration ledger; no backup export or recovery proof is available. No hosted changes were made. A new offline db:package command prepares guarded fresh/legacy SQL installation and an explicit canonical migration workspace, preserving original source hashes. Legacy mode verifies the captured catalog and does not replay bootstrap/product seeds. One transaction covers all feature SQL and history adoption; drift, occupied fresh databases, pre-existing history and late failures are denied/rolled back. Native tests verify both modes and history/grant checks. Full deployment instructions and remaining execution/backup gates are in [DEPLOYMENT_HANDOFF.md](../operations/DEPLOYMENT_HANDOFF.md). The user requires the existing project to stay Free, with no new cloud resources. Code preparation is not hosted migration or release verification.

## Free-only rehearsal continuation — PR #38, 1 November 2026

Entry main: 48af795ca5ea54bfa37ebef0eb5365e046cf7567 (#37). User-confirmed Windows configuration points to zbmerhexucqxazuxjmmw; production/collaborator dependencies remain unknown. The user now requests keeping the existing project on Free, with no new cloud project/branch. Hosted database, Auth, credentials and records remain unchanged. Earlier same-organization quotes were project $0/month subject to free quota, branch $0.01344/hour plus paid-plan eligibility; neither option is approved for creation.

The isolated PostgreSQL acceptance suite adds a separate, never-overwritten local database populated BEFORE all 13 feature migrations. It verifies every original row/column after each checksummed migration across Auth fixture data and all 13 legacy public tables, including varied membership/grant/subscription/account states, existing sessions, custom product names, CRM/Music records and audit history. It asserts only the intended role definitions/default versions/public session IDs appear, invited members are not activated, and browser-role access remains denied. Fixture Auth is synthetic, not a real Supabase Auth restoration. Per-migration timing includes preservation comparisons and is explicitly NOT hosted downtime evidence. No historical migration is rewritten or ledger silently repaired.

The Work shell maps only UID 0, so native PostgreSQL cannot start safely here. The root refusal remains intact; native acceptance uses existing CI services/helpers. Hosted backup/export, restore rehearsal, real Auth/PostgREST, historical ledger reconciliation and any migration on the existing candidate still require separate approvals. Six moderate development dependency findings remain unchanged.

## Read-only target preflight — PR #37, 1 November 2026

Populated target remains explicitly unapproved for writes. Read-only inventory: 6 identities/profiles, 6 organizations/memberships, 8 subscriptions/grants/individual roles, 4 CRM contacts and 3 Music requests, with unexpired session rows. All 13 later migrations are missing by object/column evidence; no ledger exists. Windows binding is not remotely verified. Organization is Free; real backup/recovery availability is unverified and no isolated hosted target exists. See [the complete ordered plan, preservation review and authorization gates](../operations/DATABASE_PREFLIGHT_20261101.md). Independent diagnostics add config:inspect and safe schema-not-ready errors without hosted changes.

Preflight diagnostic validation: 122 Node and 26 native PostgreSQL cases pass, including captured baseline equivalence and missing-column HTTP denial. PostgreSQL also passes through the disposable helper in CI. Hosted Auth/PostgREST and real backup restoration remain unverified; CI does not replace those gates. PR #37 retains all existing browser, restore, coverage, security and migration-checksum checks.

# Phase 4 implementation report — 1 November 2026

Core customer governance, product registry and lifecycle administration are merged through `b3d2c697a8598e50e3c11256d2d090c72af352a8`. This is **merged code with passing isolated acceptance**, not verified staging or deployed production. [PROGRESS.md](PROGRESS.md) records M0–M12 and exact PR #33–#35 merge SHAs. Entry main was 08f601fd0f74221aa3e80dc10367cda602e5f72f; existing modules/audits were retained.

## Implemented verticals

- Existing organizations can receive individual member invitations through the same durable encrypted outbox and purpose-bound acceptance. Organization/product roles are explicit; no platform/project authority is inherited. Renewal/cancellation is generation-fenced; expiry/replay/wrong identity and disable preservation remain enforced. Explicit account blocks are distinct from ordinary cancellation, with conservative fail-closed treatment of ambiguous historical revoked/disabled enrollment. Existing identities are never password-reset by invitation acceptance.
- /admin/customers provides bounded persisted members, roles, product terms, invitation/delivery/recovery states and audited activity. Versioned membership/role mutations audit and revoke customer product sessions atomically. The legacy role endpoint cannot implicitly create an active membership. Invited users must accept. Last-owner removal is guarded.
- /admin/products registers product/standard roles/audit atomically, edits allowlisted metadata with versions, derives immutable login paths and governs listed/unlisted visibility plus enabled/disabled/maintenance/terminal retirement. CRM/Music adapters stay code-owned. No secrets, arbitrary table/module/provider URLs or manual verification toggle are accepted. Persisted local observations distinguish configuration/reachability/degradation/unavailability; external verified remains false.
- Customer lifecycle/entitlement changes require version and impact confirmation, atomically save/audit terms/grants and revoke affected sessions/codes. Suspension/closure also revokes pending invitation delivery. Reactivation restores no old session. A DB session-insert guard prevents suspension/login races; NO KEY UPDATE keeps in-flight membership FK checks compatible. Direct ID reads/keyset pages reach products/customers beyond the first page. Legacy form lookup refresh preserves selected tenant/product and clears stale save signals.

## Validation and corrected failures

**120 Node, 25 native PostgreSQL and 22 desktop/mobile Chromium cases passed** before #35 merged, plus syntax, lint, Markdown formatting, coverage, checksummed manifest, production audit and development high-severity gate. Both disposable DB/browser helpers passed. CI uses native PostgreSQL 17, synthetic persisted identities and test transport; it does not prove hosted PostgREST or Auth. Work's root environment cannot run the ordinary-user native helper, and local Chromium is unavailable; native/browser proof comes from CI. The subsequently supplied Windows console log confirms the baseline 120 Node, 25 PostgreSQL and 22 browser cases passed there; the new preflight diagnostic changes are not yet Windows-verified.

Logical restore compared **36 tables, 186 constraints, 75 indexes, four triggers, four sequences and 12 application functions**. Populated upgrade rehearsal includes existing disabled/invited identities/sessions/default versions, deliberately failed duplicate-invitation migration with transaction rollback, and audited synthetic forward repair. Failure injections cover audit rollback, existing external Auth/delivery errors, generation/version conflicts and controlled concurrent binding/suspension. These are synthetic recovery/concurrency exercises, not hosted disaster recovery, production load evidence, a monitored incident response or RPO/RTO guarantees.

Failures fixed before merge: SQL alias ambiguity; historical test downgraded the current disable function; accessible select names prevented registry browser completion. Review fixes cover cancellation/account blocking, stale cancellations, uneditable products past page one and cross-customer selection reset. Lock compatibility was identified and regression-tested; no production deadlock is claimed. Browser reports attach synthetic customer/registry screenshots. Final acceptance adds keyboard entry/tab focus, long metadata wrapping and an explicit connectivity-only health scope; its own CI must pass before merge.

Production audit is clean. Full audit retains six moderate dev-only minimatch findings. Official latest releases remain ESLint 10.14.0 and nodemon 3.1.14; compatible tool upgrades have not closed the major-10 dependency issue. No forced major override or downgrade was used. Synthetic advisors retain pgcrypto-in-public WARN, no ERROR. Hosted advisor findings and safe remediation proposals remain in HOSTED_SCHEMA_FINDINGS.md; none were applied without approval.

## Migration and external status

CLI-generated 20261101052745, 20261101053314 and 20261101054139 follow all historical manifest dependencies; checksums are verified. **All remain unapplied hosted**, as do required earlier feature migrations on the inspected legacy-only candidate. Duplicate Music version 20261030 still requires target-specific reconciliation; no old checksummed file was renamed or rewritten.

Read-only Supabase reconfirmation found one active VSPH candidate, 13 legacy tables, no ledger/development branch, no Projects/provisioning/product-health tables and absent provisioning/customer RPC. Vercel's accessible vsph deployment is CLI Next.js with no reported Git source, not an established Express/database binding. No approved isolated target exists in the available evidence. Real Auth/email/MFA/PostgREST, runtime GitHub App, Vercel/Music source/backend/SSO and hosted recovery remain unverified. There were no hosted changes, emails, purchases, new cloud resources, secrets or deployments.

## Remaining decisions and requirements

Establish actual deployed backend/database ownership and environment classification. Designate an existing isolated target, or explicitly approve cloud creation and its cost before proceeding. Verify backup/recovery, reconcile/install reviewed missing SQL there, then run staged real Auth/PostgREST and provider acceptance before separate production rollout approval. Never bootstrap/reset/seed the existing candidate.

Independent roadmap gaps remain: MFA/privileged step-up and governed platform recovery; delegated organization-admin/self-service; broader metadata/secret-service/provider verification; global search/CSV/retention/subscription/security/external notifications; operational dependency/worker health, scheduling, monitoring, distributed limits, realistic load and incident exercises; full WCAG/zoom/real-device acceptance. Customer detail subcollections and entitlement picker retain documented bounds. Legacy bare-organization creation still needs transactional modernization. No enterprise-release completion is claimed.

Operational guides: [CUSTOMER_GOVERNANCE.md](../operations/CUSTOMER_GOVERNANCE.md), [PRODUCT_REGISTRY.md](../operations/PRODUCT_REGISTRY.md), [CUSTOMER_LIFECYCLE.md](../operations/CUSTOMER_LIFECYCLE.md), [PHASE4_STAGING_GATE.md](../operations/PHASE4_STAGING_GATE.md), [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md), [MANUAL_QA.md](../operations/MANUAL_QA.md). Earlier reports follow as historical evidence.

---

# Continued implementation report — 1 November 2026

Readiness, overdue milestone functionality and native backup/restore rehearsal are merged through [PR #31](https://github.com/ThunderKhan/vsph-control-center/pull/31), latest feature main `5e71c18fee39879d745ceb7f2ec535514e42bafb`. [PROGRESS.md](PROGRESS.md) records every new PR and exact merge SHA. Earlier Phase 2/3 sections below are historical cutoffs.

Delivered: a checksummed ten-migration manifest; explicit read-only target inspector with TLS/host/database/query-override guards; live GitHub comparison command checking provider identities and canonical details without logging tokens/private titles; project mutation/refresh busy state preventing mobile form edit loss; and daily deduplicated overdue milestone reminders for explicit managers. Reminders recheck completion, due date, active project, preferences and manager membership at delivery; demotion/revocation hides manager-only inbox entries. No email channel was added.

PR #31 CI passed all four jobs. Native logical restore matched 35 tables, 176 constraints, four sequences and eight application RPCs; it used synthetic records and no hosted data. Local validation passed 117 Node cases, syntax, lint and documentation formatting. Native CI includes 22 PostgreSQL cases and 14 desktop/mobile Chromium cases plus disposable helper runs, coverage and dependency gates. Failed checks were corrected before merge: isolated advisors needed loopback-only SSL configuration; mobile refresh raced editable form reconstruction; backup comparison needed deterministic ordering of catalog rows. Review findings about demoted managers and stale canonical details were corrected with regressions. Full production dependencies are clean; six moderate dev-tool minimatch findings remain, with no high/critical findings. No unsafe forced major override was applied.

Supabase is now connected. Read-only catalog inspection found an active legacy-only candidate with 13 RLS-enabled tables, no browser table/column grants, no migration ledger, no development branches and none of the eight required RPCs. This supersedes earlier unavailable-connector notes, but does not establish a disposable staging target. [HOSTED_SCHEMA_FINDINGS.md](../operations/HOSTED_SCHEMA_FINDINGS.md) records exact findings, advisor remediation links and the installation gate. Hosted warnings include event-trigger EXECUTE grants and disabled leaked-password protection; event-trigger return semantics mean the warning alone is not proof of an ordinary RPC exploit. No hosted database or Auth configuration was changed.

New migration 20261031065919 and all prior feature migrations remain unapplied to the inspected candidate. No live App credential/session verification, Vercel mapping or Music SSO acceptance was achieved. There was no hosted deployment, production mutation, customer email, purchase, secret change or background work. A GitHub code merge is not a database installation or production approval.

Operational commands and comprehensive manual checks are in [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md) and [MANUAL_QA.md](../operations/MANUAL_QA.md). See [STAGING_READINESS.md](../operations/STAGING_READINESS.md), [LIVE_GITHUB_ACCEPTANCE.md](../operations/LIVE_GITHUB_ACCEPTANCE.md), [OVERDUE_MILESTONES.md](../operations/OVERDUE_MILESTONES.md) and [RESTORE_REHEARSAL.md](../operations/RESTORE_REHEARSAL.md). Remaining approvals concern an isolated target/cost if needed, hosted backup/install/recovery, external provider ownership/configuration and separate backend rollout.

---

# Phase 3 implementation and acceptance — 31 October 2026

Engineering delivery is implemented as a project-scoped, read-only GitHub App workflow, verified with durable isolated database/provider/browser fixtures. Live GitHub App/Supabase/Vercel acceptance and production release remain blocked; full enterprise readiness is not claimed. Phase 3 started from verified main `25dcfed5a74f1e43c1bd49ff687a3f36cce082d7`; feature main is `c569638078a9f4deddb68e81039c74fc32a80d6c`. Final acceptance PR #26 records its own merge SHA in GitHub metadata and adds an empty-contributor response regression (104 Node cases total), exact installation-ID checking, bounded delivery HTTP throttling, clearer table screenshots and a full development-dependency high-severity gate. [PROGRESS.md](PROGRESS.md) has M0–M12 status and every Phase 3 PR/merge SHA.

## Implemented and verified

- Platform-approved project installation/account → manager repository discovery/selection → canonical metadata and bounded commit/contributor/PR/Actions/check/release/tag synchronization. GitHub owns source facts. Repository-scoped read tokens stay server-only; no PAT UI or code/deployment writes.
- Durable per-page checkpoints, expiring fenced leases, SKIP LOCKED claims, duplicate prevention, persistent backoff/attention and safe disconnect/reconnect. Optional raw-body HMAC webhooks dedupe delivery UUID/hash and queue canonical polling; polling works independently. Source data hides from clients/unrelated/revoked users and inactive connections/approvals.
- Responsive Engineering screen shows connection state/freshness/checkpoint/retry, type-filtered source records, immutable historical snapshots, explicit same-project task/milestone links and original GitHub links. No similar-name inference or fabricated deployment facts.
- Transactional in-app notification capture for assignments, milestone completion and PR/release/build failure/recovery changes; preferences, deduped outbox, bounded dispatch, failure retries/attention recovery and read ownership. Daily overdue assigned-task scan is an explicitly invoked finite batch.
- Scoped reports filter project/customer/owner/state/project creation date and reconcile stored work, milestones, requested PR reviews and retained build observations. Generated/sync timestamps distinguish freshness. Historical failed observations do not claim latest-branch health, uptime or forecasts.
- M5 static adapter/role/payload registry, truthful portal-only fallback and generic product cookie cleanup. Native tests exercise a third product's context, entitlement revocation and logout cascade without route changes. Full registry governance remains partial.
- M3 own-session inventory/public UUIDs and atomic revoke-other-session/product cascade/audit, including real concurrent denial. No hashes/cookies/device claims are exposed. MFA/step-up/recovery remain incomplete.

## Evidence and failed checks

Feature [CI 41173930156](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41173930156): **103 Node tests, 20 native PostgreSQL tests and 14 desktop/mobile Chromium cases passed**, plus syntax, lint, formatting, coverage and production dependency audit. Native PostgreSQL 17 and ordinary-user disposable PostgreSQL helper both pass; authenticated Chromium and its disposable helper both pass. [Browser report/screenshots](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41173930156/artifacts/13031983404) show only synthetic identities and fixture/sandbox data. Local supplemental PostgreSQL WASM/Chromium and SQL/HTTP checks passed; these supplement native CI and do not verify hosted PostgREST/Auth or live GitHub.

Failures corrected before merge: SQL alias ambiguity; null lease comparison; webhook/reconnect backoff bypass; check-run source timestamps; worker retry override; fixture API Origin omission. One Node 20 worker serialization failure was not merged; subsequent quiet-startup rerun passed. Development audit now reports six moderate findings via minimatch <11.0.1 (GHSA-g3hv-75wg-m249), no high/critical; production audit is clean. Current tool dependency ranges are major 10 while the published patch is major 11; unsafe forced downgrade/override was not applied. This remains explicit risk R16. Coverage output is collected without claiming full production-provider coverage. The subsequently supplied Windows console log confirms the baseline 120 Node, 25 PostgreSQL and 22 browser cases passed there; the new preflight diagnostic changes are not yet Windows-verified.

## Migration and provider state

Phase 2 migrations 002/003/004 were re-reviewed with their core schema/Music/001 dependencies. Phase 3 adds 005 delivery persistence/functions, 006 notification/reporting infrastructure and 007 session IDs/revocation. **All are unapplied hosted.** Native populated upgrade rehearsal inserts an existing disabled/invited identity, tenant and session before 005–007, then checks preservation and session ID backfill. This is not a hosted backup/restore rehearsal. No Supabase connector/runtime keys/approved isolated hosted target were available, so hosted history, backup, actual Auth and PostgREST privileges remain unverified.

Connected Vercel inventory returned 14 projects; the project called vsph is Next.js with a different hostname and no established Control Center Git mapping. No authorized VSPH project-to-Vercel binding was established; Vercel remains disabled. Music is unchanged by Phase 3 and must independently prove its source/backend/SSO. Companion [Music PR #1](https://github.com/ThunderKhan/taj-santacruz-smart-guest-platform/pull/1) was reconfirmed open/unmerged at head dff464ce98848b8c3e8a04830ed6ab5a7f0443d5. No backend deployment requiring missing migrations was performed. No real customer emails, production mutations, purchases, credential changes or automatic deployment/rollback occurred.

## Operational limits and exact remaining work

- Configure an organization-owned least-privilege App, installation/account ownership and server-only key/optional webhook secret; approve installation per project and run real sandbox comparison. Fixture success is not this live acceptance.
- Reconcile hosted migration history, take/verify staging backup, install ordered migrations and exercise real Auth/PostgREST/restore before separate deployment approval.
- At most 20 connections/project, 10×100 pages/category/cycle, 10,000 records/connection and latest 200 records/events; discovery 50×50 repos. These are bounded recent observations, not a complete GitHub archive. Check runs cover the default branch; workflow runs cover provider-returned runs. Requested reviewers are not approval decisions. Contributors/tags have unknown source timestamps.
- Explicit finite github:sync and notifications:dispatch schedulers are required for unattended refresh/reminders. The app does not start hidden workers. Provider-side removal may only be observed at the next successful poll if webhooks are absent. Event/outbox/receipt retention and operational monitoring require ownership.
- Vercel deployment/environment/failure ingestion, live URLs and release-to-deployment associations remain disabled/unimplemented pending ownership. No production promotion/rollback exists.
- M5 owner/lifecycle/environment/support/document metadata, atomic legacy admin operations and verified health; M9 global search/export/pagination, overdue milestone/subscription/security/external notices; M3 MFA/recovery/invitation governance; M11 distributed limits/restore/load/incident/alerts/full accessibility remain outstanding.

Use [GITHUB_DELIVERY.md](../operations/GITHUB_DELIVERY.md), [PROJECT_NOTIFICATIONS.md](../operations/PROJECT_NOTIFICATIONS.md), [PRODUCT_ADAPTERS.md](../operations/PRODUCT_ADAPTERS.md), [ACCOUNT_SESSIONS.md](../operations/ACCOUNT_SESSIONS.md), [PHASE3_MIGRATIONS.md](../operations/PHASE3_MIGRATIONS.md), [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md) and [MANUAL_QA.md](../operations/MANUAL_QA.md). The historical Phase 2 report follows for continuity; its status statements describe that cutoff.

---

# Phase 2 implementation and acceptance report — 31 October 2026

**Projects MVP is implemented with durable data and permissions and verified in isolated PostgreSQL/browser acceptance. Hosted rollout is NOT performed or approved; full enterprise readiness is not claimed.** Execution continued from `2131e3710a7cd52c4de4b3e5ebe26bad9f93c1dc`. Feature main is `af2abd0829b7754b8819d83b1c53325b7a7369a6`; this final acceptance/report change has its own later PR/merge metadata.

[PROGRESS.md](PROGRESS.md) contains the current M0–M12 table, Phase 2 PR URLs, all four feature merge SHAs and exact resume requirements. [PROJECTS.md](../architecture/PROJECTS.md) defines the independent project domain/permission boundary. [PROJECTS_GUIDE.md](../operations/PROJECTS_GUIDE.md) explains UI/API/installation and limits. [PROVISIONING_V2.md](../operations/PROVISIONING_V2.md) defines delivery/enrollment recovery and provider contract.

## Delivered Phase A

Customer creation now commits one idempotent tenant/entitlement/grant/job/invitation/outbox/audit transaction. UUID Idempotency-Key retries return the same workflow; mismatched payloads conflict. The HTTP request does not send email or perform compensating deletes.

An explicitly invoked worker uses stable Auth allocation IDs, encrypted delivery payloads, lease/SKIP LOCKED processing, provider idempotency keys, bounded retries/backoff and attention states. /admin/provisioning exposes state/retry/revoke/reconciled recovery. Delivery remains off by default and requires an approved authenticated HTTPS provider plus encryption key. No real recipient was contacted.

Acceptance verifies a platform-issued single-purpose expiring capability bound to one membership. Existing users must authenticate as that identity and cannot reset passwords through acceptance; new profiles stay disabled until enrollment completes. Broad account-wide bearer activation is removed. External password enrollment is an explicit saga: failures invalidate proof and require provider reconciliation, not silent activation or an atomic-Auth claim. Explicit admin disable revokes pending/in-flight enrollment; consistent profile→invitation→outbox lock ordering and a real concurrent regression prevent disable/acceptance deadlocks from undoing that intent.

## Delivered Phase B

Projects at /projects are separate from applications, entitlements and customer subscriptions. Implemented: internal/customer ownership, accountable owner/transfer, explicit manager/contributor/viewer/client roles, development-team labels, product links, project lifecycle/priority/dates, milestones/dependencies, tasks/assignments/statuses/priorities/dates, comments, HTTPS delivery evidence, activity history and source-backed progress/overdue health.

The responsive VSPH workspace preserves the collapsible desktop sidebar and mobile drawer and adds Projects to navigation. Directory search/state/keyset pagination, creation, settings, milestones, task filters/edit/status controls, team membership lookup, delivery/comment and activity screens operate through real REST/database functions. Customer sharing is explicit and excludes private work, including private evidence metadata in history. The server validates every mutation, and PostgreSQL locks/rechecks access, enforces same-project references/transitions/versions and commits activity/audit with data. Conflicting updates fail 409 rather than overwrite.

## Phase C proof and limits

- Local Node suite: **90/90**, including mocked delivery/password-enrollment failures, legacy-purpose denial, validation and preserved portal/product/security/sidebar regressions. Obsolete mocks expecting synchronous delivery/broad membership activation were replaced by native state-machine assertions.
- [Feature CI run 41123852934](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41123852934): all four jobs passed; **14/14 native PostgreSQL cases** and **6/6 desktop/mobile Chromium cases**, plus Node quality and dependency audit. Final acceptance adds desktop/mobile authenticated onboarding→queued outbox→recovery checks (eight browser cases total), plus the failure tests, and verifies the disposable database/browser helper commands as an ordinary CI user.
- Native SQL cases include RLS/privileges/FKs, tenant/session isolation, idempotent concurrent provisioning, leases/retry/capability/replay/revocation, intended-membership-only activation, project ownership/role denial/client filtering/private evidence, cross-project references, invalid states, optimistic concurrent updates, dependency completion and concurrent explicit-disable preservation.
- Authenticated browser creates a project, finds/assigns a developer/team, creates milestone/task, completes task, adds comment/evidence, reloads persisted history/progress and denies an outsider. Desktop collapse, mobile drawer and no page overflow are asserted. The browser job provisions isolated PostgreSQL with synthetic persisted sessions; no production authentication bypass exists.
- Full JavaScript syntax scanning, ESLint, Markdown format checks, npm ci/test/coverage and dependency scan are available. Local npm audit including dev dependencies reports zero vulnerabilities. No TypeScript/build command is invented.
- Supplemental local PostgreSQL WASM/Chromium runs passed; they do not replace native CI. Test SQL transport adapters do not verify PostgREST or real Supabase Auth/SMTP. Real login/SMTP/provider mailbox and hosted UAT remain blocked by unavailable staging access. The subsequently supplied Windows console log confirms the baseline 120 Node, 25 PostgreSQL and 22 browser cases passed there; the new preflight diagnostic changes are not yet Windows-verified.

Screenshot evidence: [authenticated browser report/artifact](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41123852934/artifacts/13008674757) contains synthetic desktop/mobile project captures. No customer identities/records/secrets appear. These are isolated fixture screenshots, not deployed customer pages.

## Migration and deployment state

New reviewed files, applied ONLY to disposable test engines/CI:

1. 20261031000200_durable_provisioning.sql — workflow/outbox/capability schema and service-only transaction function.
2. 20261031000300_projects.sql — project domain and permission/state/audit functions.
3. 20261031000400_invitation_disable_revocation.sql — explicit-disable revocation, proof-null guard and consistent enrollment/delivery lock ordering.

**Not applied to hosted staging or production.** Reconcile prior schema/001/Music history and install all three in approved isolated staging before deploying this backend. The disable follow-up is mandatory; do not roll out 002 alone. No deployment, secret rotation, purchase, real email, production fixture/seed or customer-data deletion was performed.

The public login/invite-help pages still boot without keys. Anonymous protected dashboard/app/admin/project routes deny or redirect. Real authenticated Projects requires configured Auth plus target migrations. Product access/subscriptions remain separate. Existing Music receiver PR #1 and unverified Vercel source binding are unchanged; no Music SSO completion is claimed. App-level GitHub/Vercel delivery integrations remain M8 work.

## Remaining requirements and risks

- Approved staging Supabase/Auth/provider credentials and schema/history/backup visibility; legacy invitation reconciliation/reissue; actual provider delivery and failure UAT. New purpose-bound flow deliberately rejects legacy links.
- External Auth/email cannot join a database transaction. Ambiguous operations require explicit operator reconciliation; do not blindly retry unknown password effects. Delivery provider must honor the documented idempotency contract and protect invitation URLs; key retention/rotation requires operational ownership.
- Expired/revoked invitations need a new reviewed invitation workflow; automated replacement and existing-tenant individual invite/self-service remain M3/M4 work. Recovery of failed/in-flight jobs is implemented.
- MVP bounds: 500 tasks, 100 milestones, 200 memberships/project; latest 200 comments/evidence/activity, bounded list/directory reads. Teams are project labels, evidence is link-based, not a global HR/team service or upload pipeline. More pagination/export and retention remain later work.
- Repository administration/protection, MFA/step-up, fleet-wide throttling/session inventory, restore/load/incident/alerting and full accessibility/real-device/zoom matrix remain incomplete. No SOC/ISO/SLA certification claim.
- Production release needs separate approval after migration verification and real UAT. No background work is claimed.

Use [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md) for exact commands and [MANUAL_QA.md](../operations/MANUAL_QA.md) for current acceptance checks. The requested core Projects workflow is implemented and tested in isolation; deployment into the user's live environment is the outstanding operational gate.
