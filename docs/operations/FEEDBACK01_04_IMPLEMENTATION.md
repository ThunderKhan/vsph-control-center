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
