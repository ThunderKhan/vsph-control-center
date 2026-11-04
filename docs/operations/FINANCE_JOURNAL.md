# Owner finance journal

`/admin/finance/journal` is a read-only history workspace, separate from the ledger's latest-50 quick-entry/correction lists. It searches all persisted invoice/receipt history in server-owned **25-row pages**. It includes void invoices, reversed receipts and historical suspended customers. No sample records are added outside the disposable test harness. This view does not create payments or silently edit/delete history; historical entry/correction forms and finance CSV export remain separate work.

## Authorization, API and money

`GET /api/finance/journal` requires a current portal session and active platform owner in HTTP and the service-only, fixed-search-path STABLE `finance_journal` RPC. Organization owners/admins, HR and product/project roles do not inherit this access. Direct browser-role function execution is denied. Each read uses its caller statement snapshot, including owner authorization; there is no cross-page frozen snapshot or push erasure of already-read data.

Query fields are allowlisted: `kind=invoices|receipts`, `status`, `search`, `from`, `to`, `organizationId`, `projectId`, `cursor`. Invoice statuses are all/issued/void; receipt statuses are all/active/reversed. Search is a literal substring across references, customer and project names; percent/underscore are not wildcards. Dates filter invoice **issued_on** or receipt **received_on**, inclusively. The UI provides type/status/text/date filters; exact customer/project UUID filters are additionally available through the authorized API. Names and row details in this API are owner-only, unlike the intentionally minimal landing-overview DTO.

Money remains integer decimal-string paise, with exact BigInt labels/balances. Limit/offset, actor, role and unknown fields are rejected; no caller can request an unbounded page. Query text is parameterized and bounded to 100 characters; invalid dates, identifiers, control/ill-formed Unicode and malformed cursor envelopes are rejected.

## Cursor and recovery contract

Rows order by created/recorded timestamp descending, then UUID descending. The RPC reads at most 26 selected rows, returns 25 and derives an optional next cursor. The cursor preserves PostgreSQL microseconds; JS validates it without reserializing through Date. Its scope checksum binds actor, record type and normalized filters. It is a consistency fence, **not** a signed capability or authorization grant. Every request rechecks owner authority. Editing filters restarts page one; incompatible cursor/filter combinations return 400.

New records above a cursor appear when restarting the first page; forward traversal does not shift existing rows as offset paging would. Concurrent voids/reversals/filter-relevant changes can change later pages. This journal is not a reconciled or immutable financial statement. UI Previous traverses its successful cursor history. Failed Next retains its attempted cursor for Retry without advancing page state. A new filter aborts/supersedes prior reads; obsolete replies cannot replace current rows. Failures, denials and invalid responses clear old rows. The browser uses a twelve-second abort deadline; this bounds the UI wait, not a claim that PostgREST cancels the underlying SQL. Backend statement limits/load monitoring remain operational work.

## Migration and repair

CLI-generated `20261104053000_finance_journal.sql` requires the existing exact-report migration. It adds one read-only RPC and four nonunique timestamp/date/order indexes; it changes no invoice, receipt, reversal, profile, subscription or grant rows. Normal CREATE INDEX can block writers during installation. The source does **not** promise zero hosted downtime; review real table sizes, lock budget and maintenance/forward-repair procedure on the approved target before installation. No hosted write or index creation is performed by this development work.

Source has 24 migrations plus baseline = 25 canonical entries. Six identities lack entries by the last recorded 19-entry hosted ledger, including this new unapplied journal migration. Existing marker/catalog equivalence remains unverified. Do not rerun bootstrap/seeds/legacy installer, rename the search gap, or blanket push the duplicate-Music-version source folder. See [partial history](PARTIAL_MIGRATION_HISTORY.md) and [deployment handoff](DEPLOYMENT_HANDOFF.md). A missing RPC gives schema-not-ready without falling back to the truncated latest-50 lists.

Rollback UI/API independently if needed; preserve historical records and additive indexes/RPC until reviewed forward repair. The native upgrade test drops/reinstalls only these fixture indexes/RPC **inside a rolled-back disposable transaction**, verifies populated invoice fingerprints, role denial and restored operation. It is not permission to drop hosted objects or proof of hosted recovery.

## Verification and remaining work

Node tests cover strict filters, forged/unbounded fields and exact cursor preservation. Native tests cover mixed status/history, literal/customer/project/date filtering, microsecond/UUID page traversal without duplicates, concurrent head insertion, wrong-owner/browser denial, expired sessions, missing RPC and populated upgrade/rollback. Chromium fixtures contain 61 void invoices and reversed receipts, so they never manufacture collected cash for existing finance journeys. Desktop/mobile tests read all three pages, filter receipts/dates, deny an ordinary user and recover from explicit mocked schema/cursor/permission failures. They do not prove live Auth/PostgREST, native Windows or hosted migration/restore behavior. Full CI is required before merge.

Finance entry/correction pickers still use the existing latest-50 quick lists. Managing older records directly, filtered financial aggregates/exports, customer billing visibility, retention and measured large-data load remain incomplete. See [manual QA](MANUAL_QA.md) and [Windows commands](WINDOWS_HANDOFF.md). No production deployment or billing-provider integration is claimed.
