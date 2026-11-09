# Feedback #01–#04: implementation and release verification

**Pull request:** [#99](https://github.com/ThunderKhan/vsph-control-center/pull/99)  
**Branch:** `feedback/ux-lifecycle-01-04-20261109`

## Implemented source changes

1. **Relocate utilities.** Notifications now live at `/notifications`, with
   a top-bar bell shortcut. Project reports are at `/reports` under the Work
   menu. Active sessions move from Projects to Account → Security
   (`/account/security`). Existing permission-scoped APIs are reused.
2. **Create a project with governance.** The owner opens a contained,
   responsive modal, reviews organization/products and may select an eligible,
   active, linked internal employee as project manager. Creation and manager
   appointment are atomic in `project_creation_command`; failure rolls back
   the project. Without an eligible manager the owner remains responsible.
   Successful persistence leads to a confirmation and project link. Reopening
   the modal cannot reuse stale wizard event handlers.
3. **Archive and guarded deletion.** An owner sees Archive on active projects.
   Once archived, the owner can type its key to request permanent deletion.
   The database examines direct foreign keys before deletion. Any delivery,
   finance, custom app, notification or other retained reference prevents
   deletion. For a truly empty archived project, only project metadata,
   membership and technical activity rows are removed, with a permanent audit
   record kept. No cascading removal of company history is performed.
4. **Recover an archived employee email.** Existing archived roster records
   continue reserving their work email. New onboarding identifies a conflict
   and directs the owner to archived employee review. Owner-only restoration
   requires the current roster version and an audit reason, preserves removal
   history and returns the same employee ID to Onboarding. HR authority,
   identity links and internal project assignments remain revoked and need
   separate authorization.

## New database migration

`supabase/migrations/20261109193000_feedback01_04_lifecycle.sql`

It creates `internal_employee_restoration_events`, the owner-checked
`internal_employee_rehire_command`, `project_creation_command`, and
`project_lifecycle_command`. It also narrows the existing removed-employee
trigger to an explicit owner-reviewed rehire transition. The migration adds
RLS and revokes browser-role table/function access. The canonical source
checksum is recorded in `supabase/migration-manifest.json`.

## Test coverage added or updated

- Disposable PostgreSQL: eligible manager appointment and denied outsider;
  atomic rollback on ineligible manager; confirmed project archive and
  deletion of empty records; refusal with retained milestones; unique employee
  record restoration; source identity and history retained; HR, client and
  anonymous privilege boundaries.
- Browser: separate notifications, reports and security pages; project modal,
  saved project confirmation; archive/delete; archived-email collision and
  owner restoration, including responsive navigation.
- Existing sessions and project reporting tests now use the relocated pages.
- Migration readiness checks include the new functions, table and version.

## Local verification

From a checkout of the branch:

```powershell
npm ci
npm run check
npm test
npm run lint
npm run check:migrations
npm run test:db:local
npm run test:e2e:db
```

For a disposable browser preview:

```powershell
npm run demo:local
```

Open `http://127.0.0.1:3001`. This demo uses a local database and simulated
authentication, not the company's hosted customer records.

## Release boundary

**Do not merge or install in production until required tests pass.** GitHub
Actions on this PR has returned failures before any test steps executed,
so those failures cannot verify application or database correctness.

The connected company Supabase project has **not** been modified by this
implementation. The forward migration must be reconciled with the exact
hosted migration ledger and installed only after independently verified
offsite backup and restore testing, approved change window, SQL review and
a role-by-role production acceptance run.

Before the migration is installed, owner-managed project creation falls back
to the existing reviewed `project_command` without a new manager grant.
The UI identifies that manager appointments require a schema upgrade.
Restoration and guarded project deletion are new RPC operations and remain
unavailable until installation.


## Stabilization review (Windows acceptance, 2026-11-09)

The supplied Windows 11 / Node 24.14.1 acceptance log established the following
baseline before the stabilization patch: 237/239 unit tests, 53/54 database
tests, 120/124 Playwright cases (two failures and two skips), syntax and
ESLint passing; the interactive demo exited with a temporary PostgreSQL
directory `EPERM` error; `npm ci` reported five moderate vulnerabilities.

### Fixes and why

1. **Windows demo lifecycle:** the upstream beta library's ephemeral cleanup
   can race a Windows PostgreSQL forkchild. The demo now gives the owning
   launcher responsibility for temporary-data removal (`persistent:true`),
   explicitly closes HTTP/SQL/PostgreSQL resources, checks whether the fixture
   port has been released, then retries bounded directory cleanup. It reports
   and retains a locked fixture rather than deleting data still in use or
   hiding a genuine cleanup failure. The demo test now **asserts exit code 0**
   after an orderly stop request. No arbitrary `taskkill` or global process
   deletion is performed.
2. **Forward migration test:** synthetic installed history was invalid: it
   claimed the Feedback #01–#04 lifecycle migration had been installed while
   its workforce/removal prerequisites were missing. The regression fixture
   now computes the complete reverse dependency closure from the manifest,
   refuses an impossible historical installation, and still exercises the
   intentional statement-error rollback, concurrency, drift, and preserved
   profile assertions. The expected `22012` error remains unchanged.
3. **Avatar menu:** the old source-regex assumed Sign out followed Profile
   immediately; the newly approved Security link made that false. The test
   now renders the real header and checks Profile → Security → Sign out
   ordering, single sign-out control, and absence of the former toolbar
   logout icon.
4. **Confirmation UX:** all native `window.confirm` fallback branches in
   employee restoration, account session revocation, project archive/draft
   dismissal, and project employee assignments were removed. The app already
   provides the shared accessible `VSPHUI.confirm` dialog. The affected
   existing browser project-assignment test now confirms through that dialog.
5. **Browser creation 403:** the new project archive/delete test was sending
   a mutating API request without the mandatory `Origin` header. It now
   tests the missing-origin request returns HTTP 403 and then creates the
   project with the correct isolated fixture origin; CSRF protection remains
   unchanged.

### Additional verification and release requirements

- Source-level checks completed: affected CommonJS syntax, demo ESM module
  body syntax, rendered avatar menu order, zero native confirmation calls in
  newly affected project/employee/session modules, and transitive migration
  fixture dependency closure. These checks are **not** full acceptance.
- **Windows rerun required:** `npm test`, `npm run test:db:local`,
  `npm run test:e2e:db`, `npm run test:demo`, and an interactive
  `npm run demo:local` login/shutdown on the user's Windows workstation.
- **CI remains blocked:** the GitHub Actions runs report failed jobs with
  zero executed steps. Do not mark checks as passing from job conclusions
  without logs, do not bypass release rules, and do not merge while required
  suites are unverified.
- **Dependency triage:** `npm ci` reported five moderate findings with no
  package identifiers in the supplied output. The existing CI gates high or
  critical vulnerabilities in production and development dependencies. Run
  `npm audit --json` and `npm audit --omit=dev --json` on the exact lockfile
  before modifying packages; classify reachable production risk versus
  development-only exposure. Avoid `npm audit fix --force` or speculative
  major upgrades.
- **Database safety:** no live customer database migration was applied.
  The PR remains draft until the isolated checks pass and the previously
  documented backup, restore, canonical history and release gates complete.
