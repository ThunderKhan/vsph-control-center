# Recorded owner overview — verified continuation, 4 November 2026

## Current source acceptance

Entry main `dd71b7d6a465f468d1ee83d1e8a789378e557371` was verified with all four main CI jobs successful and no open PRs. The new code merge baseline is **`9638eeb5b66e5e55d42fe00cfdb7849b47b25aad`**. The following handoff PR changes documentation only; its final main SHA is reported in the delivery message rather than embedded recursively in its own commit.

| PR                                                                | Scope                                                                                 | Exact squash merge SHA                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| [#58](https://github.com/ThunderKhan/vsph-control-center/pull/58) | Existing-account employee consent, personal view and new-HR grant boundary            | `cabcefe542ee276f9b2e9c71898d8c3c0f8ef4a0` |
| [#59](https://github.com/ThunderKhan/vsph-control-center/pull/59) | Exact finance money and one report snapshot                                           | `8704d6b051117dd7bbe2967dcf382751b1ea94fb` |
| [#60](https://github.com/ThunderKhan/vsph-control-center/pull/60) | Verified consent/finance report and operational handoff                               | `dd71b7d6a465f468d1ee83d1e8a789378e557371` |
| [#61](https://github.com/ThunderKhan/vsph-control-center/pull/61) | Owner landing uses persisted finance facts; fictional preview becomes explicit opt-in | `9638eeb5b66e5e55d42fe00cfdb7849b47b25aad` |

All four checks passed for #61's final commit `b9f828570dfec23c98c8abf88eb8069344e77879` before squash merge, with no outstanding review or required approval bypass. Prior #58–#60 main checks also passed when verified. Final handoff/main checks remain required and are inspected separately before final delivery.

## What changed and how it was verified

The default owner Dashboard now shows issued invoice value, recorded unreversed receipts, outstanding and past-due balances, six cash-collection calendar months and correctly scoped invoice/customer/project counts. The former fictional executive view remains at an explicit preview link. Ordinary members retain their authorized product/workspace dashboard. New `/api/finance/overview` uses both existing HTTP/session and SQL owner checks and allowlists its envelope **and nested summary/month fields**, excluding row lists, client/project names and receipt references. It reuses `finance_report`, introduces no migration and does not claim to reduce that RPC's underlying SQL cost.

A valid empty ledger can show zero. Unavailable, malformed, unauthorized or timed-out data is cleared, with manual retry and no sample/estimated fallback. The twelve-second abort/coalescing behavior, current-session denial, BigInt money, consistent report arithmetic/calendar validation and explicit preview separation are documented in [OWNER_OVERVIEW.md](../operations/OWNER_OVERVIEW.md). Revocation is checked on requests; a denied refresh clears prior figures, with no claim of push erasure of already-read data.

- **148 Node / 38 native PostgreSQL / 48 active Chromium tests** pass. Two intentional once-per-fixture mobile variants are skipped and not counted as passes. Both native/browser disposable helpers also pass.
- Existing database-backed finance acceptance now verifies exact large overview strings, no private fields, no-store, unknown filters, anonymous/customer-admin/expired/demoted requests. Existing persisted invoice/receipt browser acceptance follows the real fixture totals onto Dashboard.
- Added desktop/mobile browser journeys verify real fixture data, explicit demo/return and ordinary-user denial. Separate clearly mocked transport scenarios verify schema error/retry, large exact money, invalid numeric data, revocation clearing, twelve-second timeout and recovery. They do not establish live provider acceptance.
- Syntax, lint, Markdown formatting, coverage, source migration checksums, both dependency gates, isolated Supabase advisors and restore pass. Restore still verifies 44 tables, 260 constraints, 103 indexes, seven triggers, four sequences and 26 required functions, with hostedRestoreVerified false.
- One local Node VM fixture initially lacked the standard browser URLSearchParams global. The fixture was corrected; production code still uses the browser API. No failed PR head was merged. Six moderate development dependency findings remain unchanged; no forced override/fix.
- Desktop/mobile screenshot captures from the first successful run were visually reviewed; a singular/plural label issue was corrected before merge. Final CI recaptures the corrected version in [the browser-report artifact](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41778013674), retained for seven days. These are synthetic database/identity fixtures. Native Windows and live Supabase Auth/PostgREST/provider behavior were not verified in Work.

## Database and deployment boundary

No hosted read/write, Auth/email/provider setting, credential, cloud plan/resource or deployment operation was performed in this continuation. Hosting remains deferred. **23 source migrations plus canonical baseline = 24 entries**; #61 adds none. The last recorded version/name ledger has 19 entries through internal employees, without fresh source-marker/catalog/backup verification. These five source identities remain pending by that evidence, in source order:

1. `20261103072229_project_work_search.sql`
2. `20261103155930_internal_hr_lock_order.sql`
3. `20261103165522_internal_employee_identity_links.sql`
4. `20261103170000_finance_ledger.sql`
5. `20261103171835_finance_exact_snapshot_report.sql`

Do not rerun bootstrap, seeds, the legacy installer or blanket db push against that target. Retain the historical search version/checksum. Existing dependency order, marker/catalog reconciliation, backups/recovery and separate target authorization remain mandatory before any hosted installation. A normal runtime missing the finance RPC shows upgrade-required; isolated browser acceptance does not install it. See [partial history](../operations/PARTIAL_MIGRATION_HISTORY.md), [previous verified migration/consent/finance handoff](CONTINUATION_HANDOFF_20261103.md) and [deployment handoff](../operations/DEPLOYMENT_HANDOFF.md).

## M0–M12 status

The table records merged implementation with its isolated acceptance. Every milestone still has the stated implementation or release gates; the application is not declared enterprise release-ready.

| Milestone | Implemented                                                                                                                  | Remaining                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M0        | Architecture, manifest, historical schema evidence and quality gates                                                         | Approved target/environment release acceptance                                                                                            |
| M1        | Tenant/product/project boundaries, durable sessions and one-use owner transfer                                               | Universal privileged step-up, distributed controls, real target acceptance                                                                |
| M2        | Idempotent provisioning, transactional invitations/outbox and recovery controls                                              | Live Auth/email/recovery acceptance                                                                                                       |
| M3        | Sessions, enrolled-TOTP verification, delegated membership governance, employee roster and existing-account consent          | New-identity internal email enrollment/outbox, broader offboarding/access review, MFA enrollment/recovery and privileged admin governance |
| M4        | Customer workspace, explicit memberships/entitlements, lifecycle/version/audit controls                                      | Broader settings/recovery and commercial/billing integration                                                                              |
| M5        | Product registry, lifecycle, adapters and health/readiness distinctions                                                      | Live configuration/secrets lifecycle and verified production Music SSO                                                                    |
| M6        | Separate Music receiver/product launch boundaries                                                                            | Real independently deployed product acceptance; HRM/HMS not implemented                                                                   |
| M7        | Projects, members/teams, milestones/tasks, assignments, comments, deliverables, history and progress                         | Global staffing/capacity, larger journals, uploads and retention                                                                          |
| M8        | Server-side GitHub ingestion/checkpoints/webhooks and explicit task/release links                                            | Live App/provider acceptance and verified Vercel project ownership/status                                                                 |
| M9        | Project notifications/reports/CSV/search, manual owner INR ledger, exact consistent finance reads and recorded owner landing | Customer finance and wider operations dashboards, broader search/retention and full finance pagination/filter/export                      |
| M10       | Negative authorization, session/replay/revocation, failure and concurrency tests                                             | Universal step-up/recovery, broader accessibility/security release review and fleet controls                                              |
| M11       | Native incremental installation, synthetic restore and failure exercises                                                     | Hosted restore/recovery, real load, monitoring/alerts and incident acceptance                                                             |
| M12       | Node/native PostgreSQL/Chromium/quality/security/checksum acceptance for delivered verticals                                 | Approved target, real Auth/providers, accessibility, backup and operational release gates                                                 |

## Resume priorities and decisions

Continue independent development with purpose-bound new-identity internal invitations/outbox and secure existing/disabled identity recovery, fuller offboarding/access review, MFA enrollment/recovery/privileged step-up, authorized customer reporting and bounded finance journal filters/pages/export. Global staffing, wider search, retention, accessibility/load/incident work and monitoring remain incomplete. Preserve current consent, domain separation and exact finance semantics.

No approval is required for source/isolated work. Hosting, target schema changes and real identity/provider acceptance remain outside this continuation. Future target writes need exact environment/dependency ownership, current catalog/history/backup verification and explicit reviewed authorization; creating a billable resource or changing credentials remains separately gated. GitHub App acceptance requires approved installation/permissions; Vercel ownership is unverified and its connector remains disabled; production Music SSO remains unverified. No Docker, AWS or hosted Supabase CLI action is required to run the Windows disposable test helpers.

Use [Windows commands and owner acceptance](../operations/WINDOWS_HANDOFF.md) and [the full manual QA checklist](../operations/MANUAL_QA.md). Normal runtime setup remains separate from isolated test data.
