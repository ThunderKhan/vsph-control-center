# Verified owner, journal and source-integrity continuation — 4 November 2026

## Merged source and current boundary

Current verified application merge is **`42c0448811a2324bd28aab085d5aa2aa82d055a6`**. Its source acceptance is 149 Node / 39 native PostgreSQL / 52 active Chromium tests, two intentional skips, both disposable helpers and all four CI gates. The additional Windows LF source-integrity code `ba41492ea71820d1a590c4402058c66516d9f465` in [#64](https://github.com/ThunderKhan/vsph-control-center/pull/64) passed all four CI jobs: **150 Node / 39 native PostgreSQL / 52 active Chromium**, two intentional skips and both disposable helpers, including real Git autocrlf simulation. The final documentation revision must pass the same gates before merge. Final delivery records the exact final main SHA and CI result rather than embedding a commit's own SHA recursively here.

| PR                                                                | Implemented work                                                                             | Exact squash merge SHA                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [#58](https://github.com/ThunderKhan/vsph-control-center/pull/58) | Existing-account employee consent, personal employment and new-HR grant gate                 | `cabcefe542ee276f9b2e9c71898d8c3c0f8ef4a0` |
| [#59](https://github.com/ThunderKhan/vsph-control-center/pull/59) | Exact financial strings and one consistent report snapshot                                   | `8704d6b051117dd7bbe2967dcf382751b1ea94fb` |
| [#60](https://github.com/ThunderKhan/vsph-control-center/pull/60) | Consent/finance acceptance handoff                                                           | `dd71b7d6a465f468d1ee83d1e8a789378e557371` |
| [#61](https://github.com/ThunderKhan/vsph-control-center/pull/61) | Persisted owner landing; fictional executive preview explicit opt-in                         | `9638eeb5b66e5e55d42fe00cfdb7849b47b25aad` |
| [#62](https://github.com/ThunderKhan/vsph-control-center/pull/62) | Verified owner overview handoff                                                              | `915d5c3c4df8d3968ce6ace150cdd1b5ca121a9e` |
| [#63](https://github.com/ThunderKhan/vsph-control-center/pull/63) | Owner journal with all-history search/status/date filters, bounded keyset pages and recovery | `42c0448811a2324bd28aab085d5aa2aa82d055a6` |

Every listed code PR merged after all four checks passed and repository review/rules were inspected. No required review or failing check was bypassed. #58–#62 main checks were also verified green. The final source-integrity increment and main are checked before delivery.

## Functionality and evidence

Existing employee/tenant/product/project domains remain separate. Employee linking is existing-account-only with purpose/session/issuer/version/fresh-password/enrolled-TOTP checks and explicit consent; it grants no implicit tenant/product/project/HR role. New-account internal email enrollment, MFA enrollment/recovery and broader offboarding remain incomplete. See [employee linking](../operations/EMPLOYEE_ACCOUNT_LINKS.md) and [prior acceptance](CONTINUATION_HANDOFF_20261103.md).

The default owner landing reads persisted exact invoice/receipt balances and six cash-collection months, with a minimal nested-field allowlist. The preserved fictional preview is opt-in. Normal members retain their scoped workspace. Values clear on failed/denied refresh; zero requires a valid empty ledger. No recognized-revenue/payment-provider inference or production metrics are fabricated. See [OWNER_OVERVIEW.md](../operations/OWNER_OVERVIEW.md).

The read-only [finance journal](../operations/FINANCE_JOURNAL.md) finds records beyond the ledger's latest-50 lists. SQL enforces owner authority, 25-row pages, literal name/reference search, status/issue-or-received date and optional exact organization/project UUID filters. Microsecond timestamp/UUID cursors are actor/type/filter-bound consistency fences, not capabilities. No frozen multi-page snapshot is claimed. Failed Next preserves its attempted cursor for Retry; superseded requests cannot overwrite current rows. Historical mutation pickers and finance CSV/client reporting remain incomplete.

The [source LF policy/helper](../operations/MIGRATION_SOURCE_EOL.md) addresses a reproduced Windows-style checkout checksum risk. It never accepts new hashes or overwrites actual SQL edits, and connects to no database. The user's Windows configuration was not inspected; tests simulate Git autocrlf behavior on Linux, not native Windows execution.

- Journal acceptance: **149 Node, 39 native PostgreSQL and 52 active Chromium**, two intentional mobile skips, direct runs and disposable helper repeats. The source-integrity code also passes the full suite with one additional Node test (150), 39 native PostgreSQL and 52 active Chromium cases.
- Native journal tests cover 60-row microsecond/tied-UUID traversal, exact money, filters, concurrent head insertion, wrong role/tenant membership, expired sessions, malformed/changed-filter cursors, missing RPC, browser denial and populated synthetic DDL reinstall/rollback with preserved invoice fingerprints. Upgrade drops are confined to a rolled-back disposable transaction, not a hosted repair recipe.
- Browser fixtures contain 61 void invoices and reversed receipts, preserving existing zero-cash baselines. Desktop/mobile read all three pages, filter history, deny ordinary access and recover from mocked schema/cursor/permission failures. Existing finance entry, owner landing, login, onboarding, Projects, sidebar, admin, products and invitation/session journeys remain in the regression suite.
- All code checks include npm ci, syntax, lint, formatting, coverage, migration checksum/dependency gates, both audits, isolated Supabase advisors and restore. Synthetic restore verifies **44 tables, 260 constraints, 107 indexes, seven triggers, four sequences and 27 required functions**, with hostedRestoreVerified false. Production audit is clean; six moderate dev findings remain unchanged.
- Failures corrected before merge: a local owner VM fixture lacked URLSearchParams; the journal's first Chromium run exposed select labels containing option text. Explicit for/id labels fixed the real accessibility ambiguity. Older finance fixture-role/checksum failures are recorded in the prior report. No failed head was merged.
- Owner desktop/mobile screenshots were visually reviewed and singular/plural labels corrected before merge. Journal desktop/mobile captures were also visually reviewed in [the final journal browser-report artifact](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41781586416), retained for seven days. Mocked transport/fake Auth does not establish real Supabase Auth/PostgREST/GitHub/Vercel acceptance. Windows execution and hosted disaster recovery remain unverified.

## Migrations and hosted status

**24 source migrations plus canonical baseline = 25 entries.** This increment adds only `20261104053000_finance_journal.sql`, following the exact-finance report. Its RPC and four nonunique ordinary indexes change no historical financial/user/subscription/grant records. CREATE INDEX may block writers; target table size, lock budget, backups, maintenance and reviewed forward repair require separate approval. No zero-downtime promise is made.

The last recorded read-only version/name ledger has 19 entries through internal employees, without fresh catalog/source-marker/backup verification. Six identities are pending by that evidence, in source order:

1. `20261103072229_project_work_search.sql`
2. `20261103155930_internal_hr_lock_order.sql`
3. `20261103165522_internal_employee_identity_links.sql`
4. `20261103170000_finance_ledger.sql`
5. `20261103171835_finance_exact_snapshot_report.sql`
6. `20261104053000_finance_journal.sql`

No hosted read/write, Auth/email/provider change, credential operation, billable resource or deployment was performed in this continuation. Hosting remains deferred. Do not replay installed migrations, bootstrap, seeds, legacy installer, rename the search gap or blanket db push the duplicate-Music-version folder. Normal runtime missing a required RPC shows schema-not-ready. Tests install only disposable loopback fixtures. See [partial history](../operations/PARTIAL_MIGRATION_HISTORY.md) and [deployment handoff](../operations/DEPLOYMENT_HANDOFF.md).

## M0–M12 status

Implemented below means merged source/isolated acceptance, not completion of every milestone or enterprise production release.

| Milestone | Implemented                                                                                                                                              | Remaining                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M0        | Architecture, manifest, historical schema evidence and quality gates                                                                                     | Approved target/environment release acceptance                                                                                            |
| M1        | Tenant/product/project boundaries, durable sessions and one-use owner transfer                                                                           | Universal privileged step-up, distributed controls, real target acceptance                                                                |
| M2        | Idempotent provisioning, transactional invitations/outbox and recovery controls                                                                          | Live Auth/email/recovery acceptance                                                                                                       |
| M3        | Sessions, enrolled-TOTP verification, delegated membership governance, employee roster and existing-account consent                                      | New-identity internal email enrollment/outbox, broader offboarding/access review, MFA enrollment/recovery and privileged admin governance |
| M4        | Customer workspace, explicit memberships/entitlements, lifecycle/version/audit controls                                                                  | Broader settings/recovery and commercial/billing integration                                                                              |
| M5        | Product registry, lifecycle, adapters and health/readiness distinctions                                                                                  | Live configuration/secrets lifecycle and verified production Music SSO                                                                    |
| M6        | Separate Music receiver/product launch boundaries                                                                                                        | Real independently deployed product acceptance; HRM/HMS not implemented                                                                   |
| M7        | Projects, members/teams, milestones/tasks, assignments, comments, deliverables, history and progress                                                     | Global staffing/capacity, larger journals, uploads and retention                                                                          |
| M8        | Server-side GitHub ingestion/checkpoints/webhooks and explicit task/release links                                                                        | Live App/provider acceptance and verified Vercel project ownership/status                                                                 |
| M9        | Project notifications/reports/CSV/search, manual owner INR ledger, exact consistent finance reads, recorded owner landing and bounded searchable journal | Historical finance mutation UX, finance export/client reporting, wider operations dashboards and search/retention                         |
| M10       | Negative authorization, session/replay/revocation, failure and concurrency tests                                                                         | Universal step-up/recovery, broader accessibility/security release review and fleet controls                                              |
| M11       | Native incremental installation, synthetic restore and failure exercises                                                                                 | Hosted restore/recovery, real load, monitoring/alerts and incident acceptance                                                             |
| M12       | Node/native PostgreSQL/Chromium/quality/security/checksum acceptance, canonical LF source policy and safe normalization                                  | Approved target, real Auth/providers, accessibility, backup and operational release gates                                                 |

## Resume work and operator gates

Next independent development: purpose-bound internal new-identity invitations/outbox and disabled/existing identity recovery; fuller offboarding/access review and privileged MFA enrollment/recovery/step-up; historical finance mutation UX, controlled financial export and authorized client billing/reporting. Global staffing, uploads, wider search/retention, accessibility/load/incident exercises and monitoring remain incomplete.

No approval is needed for further source/isolated tests. Any later hosted installation needs exact target/ownership, current marker/catalog/backup verification, reviewed six-entry forward plan and explicit authorization. Real Auth/email/MFA needs approved staged identities; GitHub requires an authorized App/installation; Vercel remains disabled without verified project ownership; production Music SSO remains unverified. No Docker/AWS/billable service is needed on Windows to run the disposable helpers.

Use [Windows commands and acceptance](../operations/WINDOWS_HANDOFF.md) and the [full manual QA checklist](../operations/MANUAL_QA.md). The application is not declared enterprise release-ready solely because isolated CI passes.
