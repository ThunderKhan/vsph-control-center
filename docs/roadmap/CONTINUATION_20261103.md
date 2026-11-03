# Customer self-service implementation — 3 November 2026

Hosting is explicitly outside this continuation. The code and isolated acceptance advanced; the hosted database, Auth settings, email providers, credentials and cloud plans were not changed.

## Verified feature merges

| PR                                                                | Functionality                                                                                             | Exact squash merge                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [#41](https://github.com/ThunderKhan/vsph-control-center/pull/41) | Customer owner/admin workspace, organization name, member governance and explicit product access          | `0b94bbf1e4aa2b2f3d57957b84cb260f53d12495` |
| [#42](https://github.com/ThunderKhan/vsph-control-center/pull/42) | Customer-issued invitations, owned delivery states, renewal/cancellation and current issuer authorization | `095486d62b4b253617e0c29b6baebf10032df936` |
| [#43](https://github.com/ThunderKhan/vsph-control-center/pull/43) | Filtered authorized project-report CSV with bounded scope and formula protection                          | `8d434217f76f6a0781b21ec4d17080a7f15e528e` |

The final feature main above was re-read from GitHub after merge. A later forward-repair/acceptance PR records its own merge SHA in GitHub metadata; this document does not invent a self-referential commit hash.

All feature PRs passed the existing four CI jobs before squash merge; main checks were verified afterward. No required human review was bypassed. PR #41's initial browser checks failed because select controls lacked explicit accessible names; those were corrected and both layouts passed. Automated review identified cross-organization actor/target profile deadlocks; consistently ordered profile locks and a two-owner regression corrected that finding. PRs #42/#43 reviews completed without findings.

A final small forward repair resolves an existing recipient by email before taking issuer/recipient profile locks for pre-bind cancellation/reissue. The previously merged invitation migration remains immutable. Native coverage adds two owners inviting each other into separate organizations and cancelling both still-unbound invitations concurrently. The retained organization_invitation_core remains service-role-only. Final repair CI is recorded in its PR; earlier feature restore counts below describe their exact cutoff.

## Acceptance evidence

- 129 Node tests passed, with syntax, lint, documentation formatting, coverage, manifest checksums and dependency gates.
- 30 native PostgreSQL cases passed. New cases exercise current organization/product authority, cross-tenant denial, stale versions, concurrent updates, audit rollback, revoked/disabled/invited identities, scoped session invalidation and purpose-bound delegated invitations. Existing customer/provisioning/project/SSO regressions remain in the suite.
- The existing real invitation worker ran against the native fixture database with a deliberately failing external delivery substitute. Retry reused the encrypted capability/idempotency identity. Expired/rotated proofs and lost issuer authority between reserve/finish could not activate membership. No actual SMTP message was sent.
- 24 authenticated/public Chromium cases passed on desktop/mobile, including actual organization profile/member/product saves, reload persistence, queued/reissued/cancelled invitations and filtered CSV downloads. Disposable native and browser helper commands passed independently in CI.
- Synthetic dump/restore matched 36 tables, 186 constraints, 75 indexes, four triggers, four sequences and 16 required application functions. This is isolated recovery evidence, not a restoration of the user's private hosted backup.
- Production dependency audit passed; the six moderate development dependency findings remain unchanged. No forced dependency override was used.

Work runs as UID 0, so native PostgreSQL helpers correctly refuse here. Native/browser acceptance used ordinary-user GitHub CI services/helpers. This limitation was not bypassed. Windows commands are derived from the actual scripts; native Windows execution is not claimed.

## New migration status

| Order | Migration                                               | Hosted status                 |
| ----- | ------------------------------------------------------- | ----------------------------- |
| 1     | `20261103050509_organization_workspace.sql`             | Unapplied                     |
| 2     | `20261103051256_delegated_organization_invitations.sql` | Unapplied; depends on order 1 |
| 3     | `20261103053129_delegated_invitation_profile_locks.sql` | Unapplied; depends on order 2 |

The original 13 feature migrations and canonical baseline were installed on 2 November as separately authorized. That historical installation does not include the new three. Source checksums and dependency order include all three additions. Future target installation must preserve the canonical source-marker history; do not blindly use the original colliding Music versions or rerun bootstrap/seed/legacy install on the existing populated project. No hosted migration is requested or executed in this continuation.

The normal My organizations runtime needs these functions installed in its target. To review its behavior without hosted changes, run `npm run test:e2e:db`, which creates disposable synthetic fixtures. CSV uses the existing project_report function and adds no migration. Real email delivery requires the separately configured worker/provider; queued status never asserts delivery.

## M0–M12 status after this continuation

| Milestone | Implemented source/isolated evidence                                                              | Remaining scope                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M0        | Existing architecture, checksummed history, CI and baseline evidence                              | Deployment/environment ownership is deferred                                                                                  |
| M1        | Tenant/product/project authorization, transactional governance and negative/concurrency tests     | MFA/step-up and distributed limits                                                                                            |
| M2        | Durable idempotent provisioning, encrypted outbox, retries and recovery                           | Live Auth/email acceptance and hosted recovery                                                                                |
| M3        | Individual/customer-admin invitations, renewal/cancel, issuer rechecks and own-session governance | MFA/step-up, governed administrator recovery and owner transfer                                                               |
| M4        | Platform customer lifecycle plus customer-admin overview/profile/member/product access            | Broader organization settings, internal employee workflow, subscription communications and cross-issuer invitation governance |
| M5        | Governed product registry, explicit entitlements/roles and scoped readiness                       | Verified external adapters/secrets/provider behavior                                                                          |
| M6        | Music portal/receiver foundations retained                                                        | Proven source/backend ownership and real tenant-scoped SSO                                                                    |
| M7        | Projects, memberships/teams, milestones/tasks, comments/evidence/history/progress                 | Normal target authenticated acceptance and larger-scale pagination                                                            |
| M8        | Read-only GitHub App sync, webhooks/checkpoints, engineering/release views                        | Real App acceptance; authorized Vercel mapping remains absent                                                                 |
| M9        | Project inbox/reminders/reports and controlled first-100 CSV                                      | Global search, full pagination, retention, export-event auditing and broader notices                                          |
| M10       | Desktop/mobile/keyboard regression coverage                                                       | Full accessibility, zoom and real-device acceptance                                                                           |
| M11       | Synthetic restore, authorization concurrency and external-failure simulation                      | Monitoring/alerts, realistic load, incident exercise and hosted recovery                                                      |
| M12       | Existing CI acceptance plus the new customer/report verticals                                     | Full enterprise release evidence; hosting is intentionally deferred                                                           |

## Boss architecture comparison

The central login, server application layer and relational access model exist. Platform administration covers customers, applications, memberships, subscriptions and explicit roles. Customer owners/admins now have a distinct workspace for their own organization, employees and authorized products; customer governance never grants private internal project access or implicit product roles.

Owner/client revenue dashboards are still absent. Subscription terms do not represent collected payments, invoices or customer business revenue. A financial model and authoritative source are required before building those reports. CRM remains a basic contacts workspace. HRM/HMS are not implemented products; registering their catalog metadata would not build them. Music remains separately deployed and unverified for production SSO. Internal employee administration still needs a dedicated governed workflow rather than treating a user directory as a complete employee-management module.

## Local handoff and next work

Use [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md) for actual PowerShell install/check/test/start commands, [ORGANIZATION_WORKSPACE.md](../operations/ORGANIZATION_WORKSPACE.md) for authorization and operational repair, [PROJECT_REPORT_EXPORT.md](../operations/PROJECT_REPORT_EXPORT.md) for export semantics and [MANUAL_QA.md](../operations/MANUAL_QA.md) for the full regression checklist.

Independent next implementation: privileged-action step-up/recovery, dedicated internal employee governance, broader organization profile/communications, scoped global search/full report pagination/retention, monitoring/failure/load exercises and accessibility. Product-specific HRM/HMS and financial data requirements need their own business definitions. Hosting remains your deployment operator's responsibility; no hosting setup is necessary to continue this code work.
