# VSPH internal employees — owner and HR workflow

## Purpose

The Employees dashboard at /employees and onboarding wizard at /employees/onboarding
manage VSPH **internal staff**, not customer employees, organization roles or product access.
All directory rows, counts and departments come from persistent PostgreSQL records.
No sample employee or analytics values are fabricated.

## Permission hierarchy

| Operation | Platform owner | Authorized HR | Regular member |
| --- | --- | --- | --- |
| View staff, departments and status counts | Yes | Yes | No |
| Create an internal roster entry | Yes | Yes | No |
| Update ordinary staff fields and roster status | Yes | Yes | No |
| Update HR/owner record | Yes | No | No |
| Grant/revoke HR authority | Yes | No | No |
| Manage customer organizations / products | Existing separate permissions | No implied access | No |

Only active platform super administrators may grant HR to an **already active portal
identity** with an email matching an active internal employee record. HR permission
is a dedicated table, not a platform role. HR cannot grant additional HR access
or mutate the current HR/owner employee record.

## Onboarding flow

Capture name, unique work email, department, job title, employment type and start
date. Review, explicitly confirm and persist through an idempotent server command.
The initial state is Onboarding. Email is immutable after creation. An employee
can later be marked Active, On leave, or Inactive via versioned updates.

**Creating a roster record does NOT create a Supabase Auth account, send an email,
grant customer or product access, assign a project, or enable an HR login.**
Changing roster status does not disable an otherwise authorized portal account.
Marking an HR manager Inactive revokes the internal HR assignment atomically.
On leave temporarily suspends effective HR authority pending reactivation.

## Security and operation

- The server derives actor IDs from the existing session cookie; neither body
  roles nor browser controls can elevate authority.
- Postgres checks owner/HR authorization on every operation, including after
  revocation, using RLS-enabled service-only tables and a fixed-search-path
  command. Browser anon/authenticated roles have no direct execute/table grants.
- Employee edits use current optimistic versions, row locks and atomic audit
  inserts. Failed audit inserts roll back both changes and version increments.
- Employee list is bounded to 50 records per page using UUID keyset cursors;
  search is literal case-insensitive, and counts reflect all persisted records.
- Only ordinary staff are manageable by HR; owner controls HR authority.
- No salary, personal identity numbers, bank details or private health data
  are stored in this initial implementation.

## Database installation

The new forward migration is
supabase/migrations/20261103110000_internal_employee_governance.sql.
It depends on 20261103062727_organization_owner_transfer.sql and is recorded
in the checksummed source manifest. **No hosted database was changed.**
The live pages will require an approved target with reviewed prior migrations
and this migration applied in order. Do not replay bootstrap, demo seeds or
legacy installer against a populated project. Validate backup/restore first.

## Test and review

Run npm ci, npm test, npm run check, npm run check:migrations, npm run lint,
npm run test:db:local and npm run test:e2e:db in the repository.
Native and browser fixture tests never send actual invitations or alter hosted
Supabase Auth. Browser/manual checks: owner roster onboarding, saved metrics,
directory filtering, edit conflict, owner HR grant to existing matching account,
HR mutation of ordinary staff, HR escalation denied, HR revoke and outsider denied.

## Next milestones

Governed internal account invitations and acceptance; employee-to-portal linking;
project staffing/capacity, leave and attendance approvals, payroll with distinct
confidential permissions, notifications and real provider/hosted acceptance.
These are not claimed complete by the roster and HR permissions release.
