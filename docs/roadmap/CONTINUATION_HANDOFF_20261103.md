# Employee consent and exact finance — verified source handoff

## Completed code and evidence

Entry main was `aa5b768e5fae620ee2e68dd79aa9f0ff5ed23e7b`, with no open PRs. The existing employee roster, executive demo, finance ledger, project work, organization administration and provider boundaries were preserved. The verified code merge baseline is `8704d6b051117dd7bbe2967dcf382751b1ea94fb`; the accompanying handoff PR changes documentation only. This supersedes earlier pending counts and acceptance cutoffs below the latest entries in PROGRESS.md and IMPLEMENTATION_REPORT.md.

| PR                                                                | Implemented functionality                                                                                                                                                                                  | Exact squash merge SHA                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [#58](https://github.com/ThunderKhan/vsph-control-center/pull/58) | Purpose-bound existing-account employee consent, owner/HR request management, My employment, fresh password/enrolled TOTP, expiry/renewal/cancellation/revocation, lifecycle audit and new-HR consent gate | `cabcefe542ee276f9b2e9c71898d8c3c0f8ef4a0` |
| [#59](https://github.com/ThunderKhan/vsph-control-center/pull/59) | Exact decimal-string paise, one consistent report snapshot, new service-only owner finance read RPC, legacy dashboard delegation and concurrency/precision acceptance                                      | `8704d6b051117dd7bbe2967dcf382751b1ea94fb` |

Both code PRs merged after all four exact-head PR CI jobs passed. Repository rulesets/review state were inspected; no required human review or failing check was bypassed. #58 also passed every post-merge main job. The final handoff is subject to its own complete CI, and the final response records the verified main SHA rather than attempting to embed a commit's own SHA in its contents.

## Tests, failures and limits

- Final code PR: **148 Node / 38 native PostgreSQL / 44 active authenticated Chromium cases**. Two intentionally skipped once-per-fixture mobile variants remain; they are not counted as passes. PostgreSQL and browser suites also pass through their ordinary-user disposable helpers.
- CI runs npm ci, syntax, lint, Markdown formatting, coverage, migration checksum/dependency checks, production audit and the full high-severity development dependency gate. Six moderate development findings remain unchanged; no forced fix was used.
- Supabase security advisors pass against the isolated native fixture database. Synthetic restore verifies **44 tables, 260 constraints, 103 indexes, seven triggers, four sequences and 26 required functions**, with restoreVerified true and hostedRestoreVerified false.
- Employee acceptance covers immutable identity/purpose, current issuer/session/roster versions, fresh server-derived proof, expired/revoked/stale requests, cancellation/renewal, concurrent acceptance, session expiry during a lock wait, audit rollback, provider outage/MFA, owner adoption of a revoked HR issuer's request, offboarding/disable/re-activation and browser-role denial. Customer/product/project assignments survive employee unlinking. Existing HR mappings are preserved; new/regranted HR access requires consent. On an old schema the HR API requires the new RPC and fails closed.
- Finance native acceptance creates 9,009 test-only invoices, proves exact `9008000000000001` paise through SQL and real Express HTTP, and blocks the report's project section while a receipt commits. All report sections retain the original snapshot; the next report sees the receipt. Customer admin/anonymous/browser/stale-session/disabled/demoted-owner requests deny. Existing write idempotency, race and audit-rollback tests remain.
- The first finance CI attempt failed because the new fixture used an invalid `customer_admin` membership role. It was corrected to the actual `admin` schema value, with expiry/revocation checks added. The subsequent full CI passed. One intermediate local checksum check during consent development also failed before the new migration digest was refreshed; final manifest checks pass. No failed code head was merged.
- Chromium covers real fixture-backed employee consent/HR grant/revocation and finance persistence, plus explicitly mocked large-money transport for formatting on desktop/mobile. CI captures personal-employment desktop/mobile and owner-finance screenshots in its `browser-report` artifact (seven-day retention). These screenshots were captured by the tests, not separately visually reviewed in Work.
- Linux CI verifies the native helpers. This Work process runs as root, which the helper deliberately refuses; its guard was not bypassed and no OS user was created. This increment was not executed on native Windows. Fake Auth/provider responses do not prove real Supabase Auth/PostgREST, email, GitHub or Vercel acceptance.

## Migration and environment boundary

Source now has **23 migration files plus canonical baseline = 24 canonical entries**. New this continuation:

1. `20261103165522_internal_employee_identity_links.sql` requires HR lock repair. It adds two RLS tables, private service RPCs, lifecycle triggers and a consent gate for new HR grants. No existing identities or HR grants are backfilled into consent.
2. `20261103171835_finance_exact_snapshot_report.sql` requires the finance ledger. It adds the STABLE report and guarded replacement of only the legacy dashboard branch. Existing write code and records are preserved; unexpected prerequisite drift aborts for review.

Both are **unapplied hosted**. No hosted database/Auth/provider read or write was performed in this continuation. No email, credential, plan, cloud resource or deployment changed.

The last recorded read-only version/name evidence has 19 installed canonical entries through internal employees. This is not fresh catalog/source-marker/backup verification. The five pending identities inferred from that ledger, in source order, are:

1. `20261103072229_project_work_search.sql`
2. `20261103155930_internal_hr_lock_order.sql`
3. `20261103165522_internal_employee_identity_links.sql`
4. `20261103170000_finance_ledger.sql`
5. `20261103171835_finance_exact_snapshot_report.sql`

Search is an existing lower-version gap, not permission to rename or rewrite it. Normal runtime using the hosted target cannot be claimed to pass the new workflows until separately reviewed installation occurs. A missing consent/finance RPC returns schema-not-ready; no insecure/imprecise fallback is provided. Use disposable acceptance meanwhile. See [partial history rules](../operations/PARTIAL_MIGRATION_HISTORY.md), [employee operations](../operations/EMPLOYEE_ACCOUNT_LINKS.md), [finance contract](../operations/FINANCE_LEDGER.md) and [deployment handoff](../operations/DEPLOYMENT_HANDOFF.md).

## M0–M12 status

“Implemented” below means merged source with the described isolated acceptance, not full milestone or production acceptance.

| Milestone | Implemented                                                                                                         | Remaining                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M0        | Architecture, manifest, historical schema evidence and quality gates                                                | Approved target/environment release acceptance                                                                                            |
| M1        | Tenant/product/project boundaries, durable sessions and one-use owner transfer                                      | Universal privileged step-up, distributed controls, real target acceptance                                                                |
| M2        | Idempotent provisioning, transactional invitations/outbox and recovery controls                                     | Live Auth/email/recovery acceptance                                                                                                       |
| M3        | Sessions, enrolled-TOTP verification, delegated membership governance, employee roster and existing-account consent | New-identity internal email enrollment/outbox, broader offboarding/access review, MFA enrollment/recovery and privileged admin governance |
| M4        | Customer workspace, explicit memberships/entitlements, lifecycle/version/audit controls                             | Broader settings/recovery and commercial/billing integration                                                                              |
| M5        | Product registry, lifecycle, adapters and health/readiness distinctions                                             | Live configuration/secrets lifecycle and verified production Music SSO                                                                    |
| M6        | Separate Music receiver/product launch boundaries                                                                   | Real independently deployed product acceptance; HRM/HMS not implemented                                                                   |
| M7        | Projects, members/teams, milestones/tasks, assignments, comments, deliverables, history and progress                | Global staffing/capacity, larger journals, uploads and retention                                                                          |
| M8        | Server-side GitHub ingestion/checkpoints/webhooks and explicit task/release links                                   | Live App/provider acceptance and verified Vercel project ownership/status                                                                 |
| M9        | Project notifications/reports/CSV/search, manual owner INR ledger and exact consistent finance reads                | Executive/customer finance wiring, broader search/retention and full finance pagination/filter/export                                     |
| M10       | Negative authorization, session/replay/revocation, failure and concurrency tests                                    | Universal step-up/recovery, broader accessibility/security release review and fleet controls                                              |
| M11       | Native incremental installation, synthetic restore and failure exercises                                            | Hosted restore/recovery, real load, monitoring/alerts and incident acceptance                                                             |
| M12       | Node/native PostgreSQL/Chromium/quality/security/checksum acceptance for delivered verticals                        | Approved target, real Auth/providers, accessibility, backup and operational release gates                                                 |

## Next implementation and operator decisions

Continue source work with a separate purpose-bound internal **new-identity** invitation/outbox workflow, including existing/disabled identity recovery and a defined offboarding/access-review policy. Do not reuse organization enrollment to grant platform/HR roles. Next reporting work is actual owner/customer dashboard wiring and bounded finance journal filters/pages/export; the executive preview remains explicitly fictional, and subscription metadata remains entitlement rather than cash revenue.

No approval is needed for further source/isolated tests. Hosting remains deferred. Any later target write needs exact target/ownership verification, current catalog/source-marker reconciliation, verified backup/recovery evidence (or a separately explicit risk decision), reviewed five-entry forward plan and authorization. Real Auth/MFA/email acceptance needs approved staged identities; real GitHub needs an authorized App/installation; Vercel remains disabled without verified ownership. No Docker, AWS or billable service is required on the user's Windows machine to run the disposable native tests.

Use the [Windows commands and new workflows](../operations/WINDOWS_HANDOFF.md) and [complete manual QA checklist](../operations/MANUAL_QA.md). The application is not enterprise release-ready solely because isolated CI is green.
