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

## Operator walkthrough

1. Pull reviewed `main`, run `npm ci`, `npm test`, `npm run check`, `npm run lint`, `npm run check:migrations` and `npm run format:check`. On an ordinary local OS account, `npm run test:db:local` creates and removes only a disposable loopback database. `npx playwright install chromium` followed by `npm run test:e2e:db` tests authenticated desktop/mobile fixtures. No Docker, cloud project or hosted test seed is needed.
2. After approved migration installation, owner opens Employees and creates a roster record. Activate it after checking details. This does not create an Auth account, send an email, or grant a product subscription.
3. For an existing active ordinary portal account with the exact work email, open Account link and issue a consent request. The employee signs in, opens My employment and accepts using their password and enrolled MFA where required. A missing identity requires the separately reviewed identity-provisioning workflow; do not reuse a customer invitation to grant internal roles.
4. Owner opens HR access and grants HR to the consent-linked active employee. Sign in as HR: HR workspace and employee administration are available; HR access is absent and its direct URL/API deny. Revoke HR as owner and verify the next HR operation denies.
5. Owner/project manager creates an active project, assigns an active project membership and a task to the employee. Employee opens My work, sees only their assigned task and updates permitted statuses. A contributor's broad project detail/report/search cannot reveal coworkers' work. Explicitly assigned, currently linked project managers retain their project management authority.
6. Employee requests leave, reloads, and sees pending status. HR approves/rejects with confirmation; employee sees the persisted outcome. Try stale versions, a duplicate network retry, overlapping dates, another employee's request ID, self-approval and HR/owner protected records. No user should gain visibility by changing an identifier.
7. Employee checks in/out once per company workday. Refresh and retry must not duplicate an entry. HR may mark a past missed checkout incomplete with a reason; no paid hours are fabricated. Check records on desktop/mobile and operate forms by keyboard.
8. Open Your profile from the account footer. Save display name, multiline bio, time zone and avatar color, then reload. Email/roles remain unchanged. Customer users may customize their own profile while HRMS routes continue to deny.
9. Run the existing `npm run notifications:dispatch` worker only against the intended configured environment. It emits in-app notices, not customer emails. Employees receive only currently authorized own-task notices unless they hold an explicit broader project manager assignment. Revoked task memberships/employee links remove access to those notices.
10. Verify customer onboarding, organization/product access, subscriptions, finance owner boundaries, sidebar collapse/mobile drawer and logout as regression checks. No synthetic records should appear in production.
