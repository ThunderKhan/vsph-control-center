# Internal HRMS workspaces

Internal workforce records belong to VSPH. Customer organizations, subscriptions and product roles grant no internal HRMS authority.

| Page               | Authority                                    | Workflow                                                                                                                                              |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/hr/access`       | Active platform owner                        | Explicit HR appointment/revocation using the existing consent-bound grant API. HR cannot appoint HR.                                                  |
| `/hr`              | Owner or accepted, active HR manager         | Bounded leave review and attendance recovery; links to existing employee roster/onboarding. HR cannot review their own or protected HR/owner records. |
| `/my-work`         | Accepted linked employee, active or on leave | Own assigned tasks, own leave requests and own attendance. No directory or coworker records.                                                          |
| `/account/profile` | Current active portal identity               | Own display name, bio, time zone and initials avatar. No permission changes.                                                                          |

The sidebar shows current HR/employee capabilities. Every page and API rechecks authority on the server, and every mutation checks the current database session under locks. Hidden links are not authorization.

## Installation and recovery

Apply `20261104091848_account_profile_preferences.sql` before `20261104093317_internal_hrms_self_service.sql`, following the canonical manifest and approved backup/rehearsal process. Both are unapplied to hosted environments at authoring. HRMS adds two empty RLS-protected tables and service-only commands. It replaces `project_permission` in place: accepted staff use assigned-work self-service unless explicitly assigned as a project manager; historical revoked staff cannot recover broad contributor access. Customer identities require a matching active organization and a client-visible customer project and receive client visibility. Existing records are preserved. Contractors without workforce or customer identities retain explicit project permissions.

Review existing dual-purpose customer/contractor identities before installation. Separate identities may be appropriate; customer membership deliberately constrains internal project access. HR does not infer project management powers. A staff manager must have a current active employee identity link.

Rollback is application rollback with HRMS pages disabled; retain new records and audit history. Do not drop tables or restore the old project permission function to regain access. Correct permissions explicitly and forward-repair reviewed defects. No hosted schema or customer data is modified by test fixtures.

## Semantics

- Task status is the only employee task mutation. Assignment and current project membership are mandatory. Active projects only; project version detects concurrent changes. Normal contributor transitions apply, with no cancellation or completed-task reopening.
- Leave is a request/review record, not a balance, accrual, payroll entitlement or automatic roster status change. Overlapping pending/approved requests are rejected while holding the employee lock. Unchanged idempotency retries replay; changed payloads conflict. Only pending requests can be cancelled by their owner. Reviewer cannot approve their own leave.
- Attendance uses server timestamps and company workdays in `Asia/Kolkata`, independently of profile display preferences. One check-in per workday and at most one open entry. An earlier missed checkout may be marked incomplete by authorized HR with a reason, never fabricated checkout hours. These are self-reported presence records, not verified paid hours.
- Employee task reads page by UUID (50); own leave history is latest 25, attendance latest 31. Manager reads page by UUID (25). No all-company employee dashboard is returned to ordinary employees.
- New-identity Auth invitations, payroll, statutory calculations, leave balances, shifts, attendance hardware/geofencing and performance reviews are not implemented by this vertical. Existing roster onboarding and existing-identity consent remain separate.

## Acceptance

Use isolated PostgreSQL/Chromium fixtures. Owner appoints consent-linked HR; HR cannot open governance or call grant/revoke APIs. Employee cannot open roster/HR or read another employee's leave/attendance. Customer cannot open internal workspaces. Own task progresses through allowed states and survives reload; stale/concurrent versions conflict. Leave retry, overlap, cancellation and competing reviews preserve one outcome. Clock-in/out retries do not duplicate presence. Revoked links, revoked HR, expired sessions and disabled profiles lose access. Test keyboard forms and mobile no-overflow. Production email/Auth/MFA acceptance remains a separate staged gate.
