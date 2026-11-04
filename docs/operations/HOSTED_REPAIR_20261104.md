# Hosted database and owner dashboard repair — November 4

The six missing migrations are installed on existing project `zbmerhexucqxazuxjmmw`. No new cloud resource, billable staging branch, deployment, credential change, reset or seed was created. The owner dashboard code is restored separately; pull current main and restart the local server to receive it.

## Diagnosis and source

The screenshot's finance error was real: 19 canonical migrations existed, but the finance ledger/report/journal RPCs and employee consent/search upgrades were absent. `applications.visibility`, `customer_command` and `project_command` already existed and were not recreated. All 19 source markers matched the verified manifest; the installed employee command body matched its immutable reviewed source. The finance-only landing page from #61 was also a presentation regression; #66 restores the broader workspace using persisted facts, not the fictional preview.

| Installed source version | Purpose                                    | Prerequisite                 |
| ------------------------ | ------------------------------------------ | ---------------------------- |
| `20261103072229`         | Project work search; lower-version gap     | Organization owner transfer  |
| `20261103155930`         | Workforce lock ordering                    | Internal employee governance |
| `20261103165522`         | Purpose-bound employee identity consent    | Workforce lock ordering      |
| `20261103170000`         | Manual INR invoice/receipt/reversal ledger | Internal employee governance |
| `20261103171835`         | Exact decimal-string snapshot report       | Finance ledger               |
| `20261104053000`         | Bounded finance journal                    | Exact snapshot report        |

The package was generated from checksum-verified source after #65 passed CI. A transaction acquired the canonical installer advisory lock, locked/rechecked the exact 19-entry ledger, compared the employee function with its inspected definition, applied only the six missing source files and recorded each immutable canonical version/name/source checksum. It used a two-second lock timeout and 60-second statement timeout and notified PostgREST to reload its schema. No bootstrap, product seed, invitation delivery or existing-record update was executed. A first Supabase confirmation expired; read-only inspection confirmed no application. The second confirmation succeeded. Source main at application was `21253091d2c0ed88217460e7682e83a8ac896b18`.

Supabase also records transport receipt `20261104070249_vsph_canonical_forward_repair_20261104`. Its complete SQL SHA-256 is `7c72b69f6a2c59562e730e8da54199ba6cacad42961fd50f3c49ba7e7372cd62`, independently matched between generated SQL and the hosted receipt. The ledger now contains **25 canonical entries plus this one preserved transport receipt**. Readiness recognizes this specific identity only when its full SQL digest and all six required canonical source markers match. Unknown or altered history still blocks readiness. No history row was deleted, renamed or silently marked applied.

## Verification and preservation

[Sanitized evidence](preflight/repair-readiness-20261104.json) records object/grant checks, migration identities and aggregate counts, without identity details or credentials.

| Existing records                    | Before | After |
| ----------------------------------- | -----: | ----: |
| Auth users / profiles               |  6 / 6 | 6 / 6 |
| Organizations / memberships         |  6 / 6 | 6 / 6 |
| Subscriptions / product assignments |  8 / 8 | 8 / 8 |
| CRM contacts / Music requests       |  4 / 3 | 4 / 3 |
| Internal employees / HR grants      |  1 / 0 | 1 / 0 |
| Projects                            |      0 |     0 |

Counts are point-in-time aggregate checks, not byte-for-byte backup proof. The new consent and finance tables each contained zero rows after installation. SQL owner and actual `service_role` reads returned exact zero balances and empty invoice/receipt journals; an existing regular identity's finance read was denied. All 43 required application tables had RLS enabled and denied browser table/column privileges. All 27 required functions existed with security-definer/fixed search-path properties, service execution and no anon/authenticated execution. Product visibility and session public IDs were present. Catalog assessment found no pending source migrations or blockers; its release-ready flag deliberately remains false.

Anonymous live PostgREST probes for finance report, finance journal, project search and employee consent returned HTTP 401 / SQLSTATE `42501`, confirming schema-cache recognition and privilege denial. The first finance-report network probe failed at transport; one bounded retry passed the expected denial. Authenticated application/browser acceptance on the user's Windows server remains a separate check; no real customer password, Auth email or MFA identity was used here.

Security advisors reported no ERROR findings. Existing warnings remain for the provider-owned event-trigger execution grants and disabled leaked-password protection. They were not changed by this repair. See [anon grant guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated grant guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance INFO findings and six moderate development dependencies remain separate work; no forced overrides were applied.

## Recovery and limits

The historical private dump remains historical: this repair did not produce a fresh full hosted backup or prove hosted disaster recovery. Existing native CI proves populated forward-upgrade rollback and concurrent exclusion, plus synthetic full backup/restore; it is not a hosted Auth/vault restore. Do not run `db reset`, bootstrap or a seed against this project. The completed package refuses replay because its expected 19-entry ledger no longer matches. A failure before transaction commit rolls back feature DDL and canonical entries. A future committed repair must be a reviewed forward migration; do not drop finance/consent tables after they contain records. Reverting the dashboard code does not require undoing database migrations.

No deliberate application outage was scheduled; lock waits were bounded. The confirmation/execution duration is not a measured downtime guarantee. Hosted schema repair, local code update and production deployment are separate actions. No production deployment, live GitHub/Vercel/Music integration, hosted recovery or enterprise release readiness is claimed.

## Windows acceptance

Stop the running development server with Ctrl+C, then run these in PowerShell. No Docker or AWS is needed; the local database helpers use disposable embedded PostgreSQL and refuse hosted database targets.

```powershell
cd D:\Projects\vsph-control-center
git switch main
git pull --ff-only origin main
npm ci
npm run config:inspect -- zbmerhexucqxazuxjmmw
npm run migrations:eol
npm test
npm run check
npm run check:migrations
npm run lint
npm run format:check
npm run test:coverage
npm run test:db:local
npx playwright install chromium
npm run test:e2e:db
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npm run dev
```

The manifest-only check verifies local source; it is not another hosted installation command. Do not run the former legacy installer on the now-upgraded database. No separate typecheck script exists in this vanilla JavaScript repository. Native Windows results from before this repair were provided by the user; the newly added cases were verified in Linux CI and require a fresh Windows run.

1. Sign in as the platform owner at `http://localhost:3000/dashboard`; the heading is “Your business, at a glance.” Check customer, project, employee and product panels and the six-month cash chart. Finance starts at zero because the new ledger is empty, not because subscriptions were converted into revenue.
2. Refresh and reload; panels must read persisted records, clear stale facts on errors and recover independently. Test the explicit preview link; all fictional values must stay labelled and absent from the normal dashboard.
3. Open Applications, customer administration/onboarding, employee directory, Projects, product registry, subscriptions and the finance journal. Navigation must remain usable; a registered product is not an implicit product role or proof of a live connector.
4. Check sidebar collapse/expand, mobile drawer, keyboard focus, long names and narrow-screen layout. Sign out and verify protected pages/APIs require a new current session; a regular customer/employee must not see owner aggregates or finance.
5. Use the isolated authenticated test helpers for customer invitations, revocation, employee consent, project/task mutations and finance write/reversal scenarios. Do not populate hosted customers with fixture records to demonstrate tests. Real invitation/MFA and external-provider acceptance require an explicitly chosen test identity/integration.

See [full manual QA](MANUAL_QA.md), [owner overview contract](OWNER_OVERVIEW.md), [Windows handoff](WINDOWS_HANDOFF.md) and the [remaining roadmap](../roadmap/CONTINUATION_HANDOFF_20261104.md).
