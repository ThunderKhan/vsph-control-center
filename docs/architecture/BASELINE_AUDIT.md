# Baseline audit — 31 October 2026

Control Center main: `a32fb754dd6815fa30e3998873da372b4e080584` (PR #7). GitHub tree: 68 files. No open Control Center PRs at audit. Latest main Actions run [41107593212](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41107593212) passed. Local baseline: npm ci, 77/77 tests, syntax pass.
Music main: `3f418170a3bcd92d189e94dd510a38d5b6eafafb`; 127 files, including 39 binary photographs. All 88 nonbinary files retrieved for inspection. [Receiver PR #1](https://github.com/ThunderKhan/taj-santacruz-smart-guest-platform/pull/1) remains open at `dff464ce98848b8c3e8a04830ed6ab5a7f0443d5`. Its diff includes server helpers, five SSO handlers, React auth, tests and Vercel rewrites. Not merged: deployment provenance and persistent product authorization remain release blockers.

## Evidence and findings

| Evidence                                                        | Proven current behavior                                                                                                    | Risk / implication                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `server.js`, `db.js`, `package.json`                            | Express 5 / vanilla pages; privileged Supabase REST; fresh Auth client per password check                                  | Retain stack; key bypasses RLS so every query needs authorization                         |
| `security.js:getContexts`, `access-policy.js:permittedContexts` | Reads all organizations, app subscriptions and grants; filters afterward; platform super admin gets synthetic product role | Query scoping and platform/product separation need work                                   |
| `routes/apps.js`                                                | Record list and creation derive tenant from validated application session                                                  | Positive source evidence, not full DB-backed HTTP isolation proof                         |
| `routes/admin-management.js:POST /users`                        | Creates confirmed users with staff-chosen password; accepts super_admin                                                    | Replace with reviewed invitation governance; no MFA/step-up                               |
| `routes/admin-management.js:POST /clients`                      | Legacy multi-write tenant provisioning and compensation                                                                    | Remove unsafe alternate path                                                              |
| `routes/onboarding.js`                                          | Pending membership; invitation followed by DB writes; audit error is swallowed                                             | External side effects not atomic; no durable workflow/idempotency                         |
| `routes/invitations.js`                                         | Supabase getUser token verifies identity, then updates password and all invited memberships                                | Durable invitation purpose, expiry and per-invite acceptance absent; exploit not asserted |
| `supabase/schema.sql`                                           | 13 tables, RLS enabled, browser privileges revoked; service key bypasses RLS                                               | Bootstrap only, no known deployed history                                                 |
| `supabase/migrations/*`                                         | Atomic single-use SSO consume function and Music roles                                                                     | Two same-date filenames; explicit historical ordering needed                              |
| `public/dashboard.*`, `DESIGN.md`                               | 256/72px rail, mobile drawer, brand tokens; access metrics                                                                 | Preserve layout; no project portfolio                                                     |
| `tests/*`, `.github/workflows/node-checks.yml`                  | 77 passing tests, many mocked/source checks                                                                                | No baseline native DB/browser/staging email proof                                         |
| Music `src/store/AuthProvider.tsx`, `RequestsProvider.tsx`      | Browser demo credentials / localStorage data                                                                               | Unsuitable for production customer records                                                |

## Environment and governance

No SUPABASE_* / TEST_DATABASE_URL credentials were provided. No Supabase connector is exposed. Applied migration versions, Auth redirect allowlist, SMTP, backups, staging and production rows cannot be inspected. No production DB action performed.
Native database and Chromium test tooling is established in this change; SQL fixtures model only `auth.users`, not the Supabase Auth service. It cannot prove email delivery or Auth token purpose.
Shell Git clone cannot authenticate; source and branch/PR delivery use the connected GitHub API. Local snapshot has a synthetic Git parent; remote commits always use verified upstream SHA/tree, never this synthetic history.
GitHub main metadata says protected=false; rulesets=[]; branch-protection read returns 403 Resource not accessible by integration. Administration settings cannot be changed with this connector. Required settings are in `docs/operations/VALIDATION.md`.
Vercel exposes one team `team_0PkKI2k9PPgf4qb3UywLi1vF`, 14 projects, none named vsph-music-system or Control Center. Explicit Music project lookup in that team returns 404. No binding, live env values, deployment or SSO claim is made. Other account access is required to establish source provenance.

## Release verdict

NO-GO for customer production release. Safe to progress reviewed, tested code and isolated fixtures. Staging Auth/SMTP, migration reconciliation, permission debt and Music provenance remain gates. See risk register and milestone tracker.
