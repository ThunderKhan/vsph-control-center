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
- Supplemental local PostgreSQL WASM/Chromium runs passed; they do not replace native CI. Test SQL transport adapters do not verify PostgREST or real Supabase Auth/SMTP. Real login/SMTP/provider mailbox and hosted UAT remain blocked by unavailable staging access. Windows-native execution was unavailable.

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
