# Implementation report — 31 October 2026

**Verdict: NOT enterprise-ready; no production release performed.** Six reviewable PRs (#8–#13) were squash-merged after green checks, with main SHAs verified. Functional security corrections and reproducible validation were delivered; the M0–M12 roadmap is not complete. This report's code evidence cutoff is main `b1c298e942838ee4a0ff6178607f128fa467a5a4`. The subsequent mobile/evidence PR has its own merge metadata in GitHub.

See [PROGRESS.md](PROGRESS.md) for the M0–M12 completion table, six PR links/merge SHAs and exact resume sequence. Each merged code PR has acceptance criteria, affected code, security impact, tests and rollback/migration guidance. See [current risks](../architecture/RISK_REGISTER.md), [domain](../architecture/DOMAIN_MODEL.md), [baseline](../architecture/BASELINE_AUDIT.md) and [permissions baseline](../architecture/ROUTE_AUTH_MATRIX.md). New behavior is detailed in operations/PRODUCT_AUTHORIZATION.md and ADMIN_LIFECYCLE.md.

## What functions now

- Existing Express/vanilla application, authentication routes, dashboard/sidebar, customer wizard and separate Music product boundaries remain.
- Legacy staff-password creation/elevation endpoints return 410; the UI uses existing email onboarding instead. Standalone tenant invitations are not falsely presented as delivered.
- Platform administrators retain central governance but require explicit active membership/product roles to operate customer products. Context reads are tenant-scoped and bounded. Future subscription starts deny access; explicit product allowlists deny generic writes for viewer/musician/unknown roles.
- CSP/security headers, no-store API errors, request IDs/safe central errors, parser limits, explicit proxy configuration and bounded per-process attempt limits operate in the server. Distributed throttling is not implemented.
- Account status uses an atomic, service-only Postgres function that rechecks the actor, locks the target, revokes portal/app sessions and Music launch codes, changes status and audits once. Repeat requests and audit failure are tested. This function must be installed before deploying that route against hosted Supabase.
- A small mobile headline whitespace correction is covered by a real rendered browser assertion; public login screenshots are included. No UI-only project/customer/integration feature is claimed.

## Verification evidence

| Check                       | Evidence and limits                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                      | Successful locally and in fresh GitHub Actions checkouts; no direct shell Git authentication in Work                                                                                                                 |
| npm test                    | 89/89 Node tests passing after combined M1 changes                                                                                                                                                                   |
| npm run check               | Existing syntax command passes; ESLint also parses newly introduced JS                                                                                                                                               |
| npm run lint / format:check | Pass; lint is a focused correctness rule set, formatting gate covers architecture/operations/roadmap Markdown                                                                                                        |
| npm run test:coverage       | Pass; observed Node report 75.75% lines, 77.67% branches, 61.76% functions across imported files; no full-coverage assertion                                                                                         |
| Native PostgreSQL 17 CI     | 10/10: schema/migrations, RLS/browser privileges, composite FKs, Music role scope, concurrent unique slug/code consumption, session cascade, DB-backed Express matrix, atomic disable/idempotency and audit rollback |
| Database transport scope    | Express tests execute native SQL through a test-only query adapter; they do not verify PostgREST/Supabase Auth/SMTP                                                                                                  |
| Chromium CI                 | 4/4 desktop/mobile public-login/redirect/invite-help cases; no authenticated staging UAT claim                                                                                                                       |
| Local browser               | All 4 smoke cases passed using available Chromium fallback and isolated config; this is supplemental visual/flow evidence, not browser-security or Safari/real-device certification                                  |
| Dependency scan             | npm audit with and without omit=dev reports zero vulnerabilities locally; production audit job passed on merged heads                                                                                                |
| Final code PR CI            | Fresh #13 head eec0e1b: all four jobs passed; native DB logs explicitly report tests=10, pass=10, fail=0                                                                                                             |
| npm run dev                 | Starts nodemon/Express and prints port 3000; same-process route probes confirm behavior below                                                                                                                        |
| Windows                     | PowerShell syntax supplied; no Windows runtime was available, so Windows-specific execution is unverified                                                                                                            |

CI runs: [#8](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41110698545), [#9](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41110893511), [#10](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41111327981), [#11](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41111785925), [#12](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41112058764). [#13 fresh-head run](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41113565687) passed; its earlier cache-restore timeout was not merged as passing.

## Migration / environment / deployment state

New SQL: `supabase/migrations/20261031000100_atomic_profile_status.sql`. Tested against empty/populated disposable PostgreSQL fixtures and reinstalled without row loss. Installs one function; no application rows change during installation. NOT applied to hosted staging/production. Existing hosted versions of schema.sql and the two Music migrations are UNKNOWN. Root duplicate bootstrap/history normalization remains M2; do not execute bootstrap on existing customer data. Deployment sequencing and rollback are in [ATOMIC_IDENTITY_MIGRATION.md](../operations/ATOMIC_IDENTITY_MIGRATION.md).

No Supabase service credentials, staging project, Auth redirect configuration, SMTP test recipient, backup access or migration history was available. No real customer email, credential change, seed, data deletion, paid service provisioning or production deployment was performed. Code merge is not proof of deployment. Actual account disable after deployment intentionally revokes that selected user's sessions within an audited transaction.

Music: main remains `3f418170a3bcd92d189e94dd510a38d5b6eafafb`; [receiver PR #1](https://github.com/ThunderKhan/taj-santacruz-smart-guest-platform/pull/1) remains open. The connected Vercel account exposes one team and 14 projects; explicit `vsph-music-system` lookup returns 404. Public page retrieval also could not be verified here. Git/source/domain ownership, live receiver/env/migrations and secure persistent Music operations remain unverified. Music localStorage is prototype data; SSO remains disabled unless separately configured and verified.

GitHub initial main metadata says protected=false and rulesets=[]; administration read returned 403. Required settings are in [VALIDATION.md](../operations/VALIDATION.md). No review/check bypass occurred. Application-level GitHub/Vercel delivery integrations remain unimplemented.

## Verified route behavior without Supabase configuration

| URL                                                  | Observed                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| http://localhost:3000/login                          | 200; public sign-in renders                                                   |
| /dashboard, /applications, /admin, /admin/onboarding | Anonymous 302 to /login; authenticated workflows need staging keys/fixtures   |
| /accept-invite                                       | 200; help landing renders, no workspace access                                |
| /projects                                            | 404; portfolio is not built                                                   |
| /api/health                                          | 503; correctly reports unconfigured database                                  |
| External Music launch                                | Production SSO not verified; public demo is not an authenticated launch proof |

## Screenshots, QA and handoff

Public login: [desktop](../screenshots/login-desktop.jpg), [mobile](../screenshots/login-mobile.jpg). These show the existing design and mobile word-separation correction on synthetic unconfigured pages; no protected customer content. Authenticated admin/onboarding/product screenshots remain unavailable without staging identity fixtures. CI reports attach public login captures automatically.

Use [WINDOWS_HANDOFF.md](../operations/WINDOWS_HANDOFF.md) for exact PowerShell install/test/run commands. Use [MANUAL_QA.md](../operations/MANUAL_QA.md) for the comprehensive role/tenant/onboarding/subscription/project/GitHub/Music/audit/security/responsive/logout checklist. Unchecked or unimplemented cases are release blockers, never reported as passes.

## Remaining access and approval gates

1. Approved isolated staging Supabase/Auth/SMTP and migration/backup visibility; reconcile history and apply the reviewed atomic identity function before backend rollout.
2. Repository administration access or maintainer-applied protections; preserve human reviews if required by policy.
3. Actual Music Vercel owner/team/project and Git binding; independent persistent product backend and staged SSO proof before activation.
4. Business/operations ownership, restore/load/incident evidence, and separate production migration/deployment approval after the remaining roadmap is built and accepted.

No automatic continuation/background work is claimed. Resume from the tracker; substantial engineering remains, especially durable onboarding/invitation state, first-class projects/delivery, real integrations, customer self-service, MFA, notifications and operational recovery.
