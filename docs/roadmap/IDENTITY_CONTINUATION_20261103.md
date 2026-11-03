# Identity and ownership continuation — 3 November 2026

Started from verified main `27c3317858bdc37ac0e7e3c3983ab933dca32958` (#44) with no open PRs. Hosting and hosted database/Auth changes remain outside this continuation. Existing architecture and working modules were retained.

## Completed feature merges

| PR                                                                | Implemented behavior                                                                                                                                | Exact squash SHA                           |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [#45](https://github.com/ThunderKhan/vsph-control-center/pull/45) | Server-owned enrolled-TOTP verification for portal and product sign-in, provider assurance/identity checks and local verification-session cleanup   | `ab44748f6f55cf73a79a601f82e33f46bceaecc4` |
| [#46](https://github.com/ThunderKhan/vsph-control-center/pull/46) | Governed sole-owner transfer, fresh password/TOTP, two-minute session/tenant/target/version-bound proofs and atomic ownership/audit/session changes | `b49fa2ac221f55f26b0d3890692b65df62f9b031` |

Feature main was re-read after each merge. Both PRs passed all four CI jobs before squash merge, with automated review reporting no findings. There were no failed checks in these two PRs. Final input review also bounds ownership versions to PostgreSQL integer range, so oversized client versions are rejected before a database cast rather than becoming a server error. A later validation/acceptance handoff merge records its own exact SHA in GitHub metadata rather than inventing a self-referential value here.

## Verification

PR #45 passed 138 Node, 31 native PostgreSQL and 26 desktop/mobile Chromium cases. PR #46 passed **139 Node, 32 native PostgreSQL and 28 desktop/mobile Chromium cases**. Disposable native database and authenticated browser helpers passed independently. Syntax, lint, formatting, coverage, migration checksums, security advisors and both dependency gates passed.

Synthetic restore after #46 matched **37 tables, 198 constraints, 78 indexes, four triggers, four sequences and 18 required functions**. This is not restoration of the user's private hosted backup. Work runs as UID 0, so its ordinary-user native PostgreSQL guard was preserved; native/browser execution used the existing CI services/helpers.

The database-backed HTTP tests verify that incomplete/incorrect MFA creates no durable portal session. Owner tests cover authorization hierarchy, cross-tenant/multiple-owner denial, current session/scope/version binding, expiry/rotation/replay, audit rollback, concurrent transfer, preserved product roles and rejected browser RPC/table access. Actual credential service calls run through explicit fake provider implementations in test fixtures; no production environment bypass or real customer credential is used. These tests do not prove live Supabase Auth/TOTP behavior.

[Chromium screenshots/report](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41591010055/artifacts/13209763568) includes synthetic desktop/mobile ownership acceptance. The existing CI artifact retention is seven days. See the operational guides for permanent workflow/authorization documentation.

## Source versus installed status

MFA-aware sign-in requires no new migration. Owner transfer adds `20261103062727_organization_owner_transfer.sql`, depending on the three previous self-service migrations. All four are **unapplied hosted**:

1. `20261103050509_organization_workspace.sql`
2. `20261103051256_delegated_organization_invitations.sql`
3. `20261103053129_delegated_invitation_profile_locks.sql`
4. `20261103062727_organization_owner_transfer.sql`

The current manifest verifies 17 source migrations; a complete fresh canonical installation includes the separate baseline entry (18 journal entries). Historical source/checksums remain unchanged. Do not replay bootstrap, seeds or the legacy installer against an already populated/journaled database. Future target installation must preserve canonical history/source markers and apply reviewed forward changes.

Last recorded hosted installation remains the separately authorized 2 November installation of the original 13 feature migrations and baseline. It was not re-inspected or modified in this code-only continuation. No hosted SQL, Auth enrollment/settings, real identity creation, customer email, provider credential, cloud plan, paid resource or deployment changed. Existing Free-only preference and restore-rehearsal waiver remain; hosted backup restoration is still unverified.

## M0–M12 status

| Milestone | Current implemented/tested scope                                                          | Remaining scope                                                                                           |
| --------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M0        | Architecture, source manifest, CI, prior installation evidence                            | Hosting/environment work deferred to deployment operator                                                  |
| M1        | Existing tenant/product/project boundaries plus session-bound owner-transfer proofs       | Universal step-up, distributed controls and real target acceptance                                        |
| M2        | Durable idempotent onboarding/outbox/reconciliation retained                              | Live Auth/email and hosted recovery evidence                                                              |
| M3        | Enrolled TOTP sign-in, customer invitations/session governance and owner-transfer step-up | Factor enrollment/unenrollment, recovery, old-session governance and broader privileged-action protection |
| M4        | Platform/customer self-service and transactional accepted-admin ownership transfer        | Internal employee workflow, broader profile/settings/communications and governed lost-owner recovery      |
| M5        | Governed registry/adapters/explicit entitlements retained                                 | Live external provider/secret-service verification                                                        |
| M6        | Separate Music integration foundation retained                                            | Verified source/backend ownership and production tenant-scoped SSO                                        |
| M7        | Projects MVP retained with regression coverage                                            | Target UAT and larger-scale pagination                                                                    |
| M8        | Read-only GitHub engineering/release foundation retained                                  | Live App acceptance and authorized Vercel mapping                                                         |
| M9        | Project notices/reports/bounded safe CSV retained                                         | Global search, full pagination/retention/export auditing and broader notices                              |
| M10       | New desktop/mobile MFA/ownership journeys plus existing responsive tests                  | Full accessibility/zoom/real-device matrix                                                                |
| M11       | Expanded native failure/concurrency/restore proof                                         | Monitoring/alerts, realistic load/incident exercise and hosted recovery                                   |
| M12       | All existing isolated gates pass for the completed verticals                              | Real provider/target/recovery/operations release evidence; hosting deferred                               |

## Security limits and resume point

Enrolled TOTP is verified; enrollment/recovery is not implemented. Existing opaque portal sessions are not retrospectively AAL2-certified or automatically revoked by a factor change. Unsupported enrolled methods deny password-only sign-in. Temporary provider sessions use explicit local sign-out, never global logout. Owner-transfer proof is consumed only with the ownership/audit transaction and never grants a product/project role.

This step-up protects the new customer-owner transfer path. Existing higher-trust platform customer-governance permissions remain separate; this is not a universal step-up gate on all administrative endpoints. Lost-owner/platform recovery cannot be performed by weakening this self-service boundary. Six moderate development dependency findings remain unchanged; production audit remains clean. Prior hosted advisor warnings were not remediated or reclassified in this continuation.

Next independent implementation: dedicated internal employee governance, broader organization settings/communications, universal sensitive-action reauthentication, governed recovery/enrollment, scoped search/pagination/retention, and operational monitoring/failure/load/accessibility. Revenue reporting requires an authoritative financial model; HRM/HMS are separate unfinished products. Hosting is not a prerequisite for continuing source/test work.

Use [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md) for actual install/test/start commands, [MFA_SIGN_IN.md](../operations/MFA_SIGN_IN.md) and [ORGANIZATION_OWNERSHIP.md](../operations/ORGANIZATION_OWNERSHIP.md) for authorization/repair, and [MANUAL_QA.md](../operations/MANUAL_QA.md) for complete regression checks. Normal owner-transfer runtime requires the four reviewed forward migrations; `npm run test:e2e:db` exercises isolated fixtures without touching Supabase. No native Windows or live-provider execution is claimed by Linux/CI evidence.
