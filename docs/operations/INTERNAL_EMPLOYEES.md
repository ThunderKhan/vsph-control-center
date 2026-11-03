# VSPH Internal Employees — Owner and HR Workflow

## Purpose

The `/employees` dashboard and `/employees/onboarding` wizard manage VSPH **internal staff**, not client organizations, customer employees, or product access. Directory counts and department statistics come from persisted PostgreSQL rows, not sample analytics.

## Permission Hierarchy

- **Platform owner (platform `super_admin`):** View, create, and edit employees; govern HR assignments.
- **Authorized HR manager:** View, create, and edit ordinary employees, but not HR managers or platform-owner records. Cannot assign or revoke HR.
- **Ordinary user:** No internal workforce access.
- **Customer and product administrators:** Their customer-level roles do not grant internal HR privileges.

To grant HR authority, the owner selects an active internal employee whose normalized email exactly matches an existing active VSPH portal account. HR permissions are stored separately from `platform_role` and customer/product memberships. All actions check current authorization in PostgreSQL.

## Employee Onboarding

Capture full name, unique work email, department, job title, employment type, and start date. Review and confirm the details. The server creates an auditable record with initial status `onboarding`; an idempotency key protects retries. The work email is immutable in ordinary updates.

**Creating a roster record does not create a login account, send an email, grant project or product access, or appoint an HR manager.** Changing the roster status also does not disable the employee's existing portal account. Setting an HR manager to `inactive` revokes their internal HR assignment. An HR manager on leave temporarily loses HR authority until returned to `active`.

If a portal identity is disabled, its HR assignment is deleted in the same database transaction. Re-enabling that identity does not restore HR authority; the platform owner must grant it again.

## Security

- Server requests derive actor identity from validated portal sessions, never from browser-supplied roles.
- The RLS-enabled `internal_employees` and `internal_hr_managers` tables are inaccessible to browser database roles.
- The service-only `internal_employee_command` uses a fixed search path and database authorization checks.
- Mutations use allowlisted fields, optimistic versions, row locks, and atomic audit entries; audit failures roll back the change.
- The directory uses bounded 50-row keyset pages, literal case-insensitive search, and real database counts.
- The initial version stores no compensation, bank details, national ID numbers, or private health records.

## Database Installation

The new forward migration is `supabase/migrations/20261103110000_internal_employee_governance.sql`, after `20261103062727_organization_owner_transfer.sql`. It is included in the checksummed migration manifest.

**No hosted Supabase database was changed by this feature branch.** Live pages require an explicitly approved deployment target, verified backups, and reviewed forward migrations applied in order. Do not rerun the bootstrap script, demo seeds, or legacy installer on a populated project.

## Verification

Run the following commands in the project repository:

```powershell
npm ci
npm test
npm run check
npm run check:migrations
npm run lint
npm run test:db:local
npm run test:e2e:db
```

Test owner onboarding and persisted counts, filtering, employee updates, HR grants to matching existing accounts, HR restriction from owner-only actions, role revocation, outsider rejection, and mobile/keyboard navigation. CI database fixtures must never touch hosted records.

## Future Work

Governed identity invitations, internal account linking, employee project assignment, staffing capacity, leave and attendance approvals, secure compensation and payroll permissions, notifications, and production provider acceptance are separate projects. This release makes no claim to implement them.

## Lock ordering repair

Forward migration `20261103155930_internal_hr_lock_order.sql` wraps the original command with profiles → employee UUIDs → HR mapping locks, then retains all original current-authority, version, protected-target and audit checks. Direct EXECUTE on the retained core is revoked, including from service_role. Pending HR mutations cannot hold an HR mapping while waiting on an owner-locked employee row; a completed revocation denies subsequent work after the wait. Reads serialize on the HR caller's own roster. Versions must fit positive PostgreSQL integers. The migration changes no rows and remains unapplied hosted. Use a reviewed forward repair rather than regranting the core or editing historical checksums.
