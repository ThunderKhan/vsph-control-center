# Owner Finance Ledger — Phase 1

## Purpose and accounting boundary

`/admin/finance` is a **platform-owner-only** reporting and data-entry workspace
for actual, manually recorded INR invoices and cash receipts. It is not a
subscription billing provider, payment gateway, bank reconciliation service,
tax engine, or accrued/recognized revenue accounting module.

- **Invoiced**: total of issued (nonvoid) invoice face amounts.
- **Collected**: sum of recorded cash receipts, excluding explicit reversals.
- **Outstanding**: open invoice face value minus collected cash.
- **Past-due balance**: unpaid balance for invoices with due dates before today.
- **By client / by project**: aggregates based on the invoice's existing customer
  organization and optional same-tenant project.
- **Monthly collections**: payments grouped by their stated received date;
  six consecutive calendar months including zero-collection months.

All calculations happen inside the server-owned PostgreSQL
`finance_command` function, not from cosmetic frontend figures. An active
subscription, an issued invoice, or an unpaid project milestone does **not**
automatically count as collected cash or realized revenue.

## Data-entry flow

1. As an active VSPH platform super administrator, open `/admin/finance`.
2. Choose an active customer, optionally select a customer project, and enter
   a unique invoice reference, integer-paise-equivalent INR amount, issue date,
   and due date. Review and confirm; an idempotency key protects retries.
3. After independent confirmation of bank/cash receipt, record its reference,
   amount, and received date against an open invoice. The backend prevents
   total unreversed receipts exceeding the issued amount even under
   simultaneous requests.
4. If a receipt was entered incorrectly, explicitly reverse it with a reason.
   The original receipt and reversal stay recorded; nothing is silently deleted.
5. Void an invoice with reason/version only after reversing its receipts.

The invoice/customer link is immutable after creation in this phase. The owner
cannot link a project owned by a different tenant. Invoice references and
payment references are globally unique; duplicates return a conflict.

## Security controls

- Only an active `profiles.platform_role='super_admin'` is authorized. HR,
  ordinary employees, client administrators, and app administrators are denied.
- API requests use existing validated portal sessions and CSRF origin checks.
  Browser-supplied actor IDs and role strings are ignored.
- `finance_invoices`, `finance_payments`, and `finance_payment_reversals`
  are RLS-enabled and deny direct `anon`/`authenticated` table access.
- The fixed-search-path database function is executable only by `service_role`.
- All writes create an audit entry in the same database transaction. Failed
  audits roll back mutations.
- Invoice idempotency and cash receipt idempotency prevent duplicate writes;
  invoice row locks serialize concurrent receipt additions and block
  over-collection. Reversals are explicit and unique per receipt.
- Amounts are stored as positive `bigint` **paise**, never floating-point
  rupees. This version supports INR only.
- The owner dashboard reports the latest 50 invoices and 50 receipts, plus
  top 20 client/project groupings; these lists are **not** an exhaustive
  export or a paginated finance journal.

## Installation boundary

Forward-only source migration:
`supabase/migrations/20261103170000_finance_ledger.sql`, following
`20261103110000_internal_employee_governance.sql`. The source manifest records
its SHA-256 and dependency. **The hosted Supabase database was not modified**
by this development task. Only apply to an explicitly approved target after
verifying restorable backups and reconciling the previous 19 migrations.
Do not replay bootstrap, seed records, or silently repair migration history.

The real Finance page will display `SCHEMA_NOT_READY` until that migration is
installed on the configured target. Existing executive overview demo cards
remain demo-only and deliberately do not pretend to be connected to this
ledger. Connecting owner/client dashboard KPIs is the next milestone.

## Acceptance

Run these in a disposable development database, not the hosted customer DB:

```powershell
npm ci
npm test
npm run check
npm run check:migrations
npm run lint
npm run test:db:local
npm run test:e2e:db
```

The native DB tests cover empty reports, invoice creation/replay, same-tenant
project validation, duplicate reference denial, receipt caps, concurrent
overpayment refusal, reversible receipts, voiding, anonymous privilege denial,
and failed-audit rollback. Owner HTML/Express checks are separate.

## Next implementation milestones

1. Integrate live finance reports into the owner executive dashboard with
   accurate labels and interactive period/client/project filtering.
2. Add scoped customer invoicing visibility and an owner-reviewed export.
3. Add payment provider reconciliation, credit notes, multi-currency and
   taxes only after business/accounting requirements and privacy rules.
4. Link internal employees to governed identity invitations and permitted
   project assignments, without mixing client and VSPH HR authority.
