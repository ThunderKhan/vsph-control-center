# Recorded owner overview

The verified platform owner's default `/dashboard` shows persisted finance facts. The historical fictional executive preview is preserved at `/dashboard?preview=executive`, behind the same verified owner UI boundary and a prominent illustrative-data notice. Ordinary/customer users retain their own product/workspace overview; the query parameter cannot grant owner access. Applications navigation remains separate.

## Meaning and data ownership

Four exact INR-paise balances come from `finance_report`: issued nonvoid invoice value, recorded cash collected excluding reversals, outstanding value and past-due unpaid value. Six calendar months show recorded receipts by received date. Counts mean issued/void invoices and customers/projects **with issued invoices**; they are not a total customer directory or staffing metric. A zero balance is shown only after a successful valid response. No trend forecast, uptime, growth, billing-provider or recognized-revenue metric is inferred.

`GET /api/finance/overview` uses the existing portal session, active platform-owner middleware and SQL owner authorization. Its allowlisted response contains only summary, six monthly observations, currency, accounting basis and ledger date. It excludes individual invoice/receipt references, customer/project names and row lists. It accepts no filters or caller identity. The existing stable report supplies one statement snapshot and decimal-string money. The server still executes the full finance report internally; this projection reduces transport/private detail, not SQL cost. Pagination and a dedicated optimized aggregation remain future performance work.

No new schema or migration is introduced. The existing exact-finance report and ledger migrations must be installed on a separately approved target. Source remains 23 migrations plus baseline; the five pending identities inferred from the last recorded hosted ledger remain unchanged. No hosted schema/Auth/provider/deployment changes are part of this increment.

## Failure and privacy contract

The UI starts empty, clears previous facts on refresh and every failure, and offers manual retry. A twelve-second abort deadline bounds a stalled read; overlapping refresh clicks are coalesced. Missing schema gives an installation explanation, access revocation clears balances, and session expiry returns to login. Invalid numeric/rounded money, inconsistent summary arithmetic, bad dates/counts/currency/basis or nonconsecutive monthly data are rejected. No fallback estimate, sample balance, localStorage record or background polling is used. Labels/balances use BigInt; decorative bar percentages scale integers before converting the bounded percentage to Number.

Recorded facts and the illustrative preview never share a visible panel. Returning from preview loads a fresh report. A current owner can still open customer administration, employee directory, Projects and Finance if this report is unavailable; each destination enforces its own authorization. No product role is inherited.

## Acceptance and repair

Node dashboard tests preserve normal workspace/product behavior and explicit preview gating. Native database-backed HTTP tests verify the exact large-money overview DTO, omitted private row fields, no-store, unknown-filter rejection, anonymous/customer-admin/stale-session/demoted-owner denials. Existing invoice/receipt persistence Chromium now follows the persisted balance onto the owner landing page. Additional desktop/mobile Chromium checks use real fixture-backed overview data, explicit preview/return, ordinary-user denial and screenshots; separate transport fixtures test schema failure/retry, exact large amounts, invalid numeric DTO, revocation clearing, timeout and recovery. Fake responses verify presentation, not live provider behavior. All existing quality/native/browser/advisor/restore/dependency gates remain required before merge.

Rollback may restore the former landing page while keeping finance security and exact-money contracts. No data or schema rollback is needed. Do not silently replace failed recorded data with the illustrative preview. Native Windows, hosted PostgREST/Auth, real provider, backup and release acceptance remain separate. See [Windows handoff](WINDOWS_HANDOFF.md), [finance semantics](FINANCE_LEDGER.md), [manual QA](MANUAL_QA.md) and [remaining M0–M12 work](../roadmap/CONTINUATION_HANDOFF_20261103.md).
