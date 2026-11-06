# Temporary employee credentials: installed 6 November 2026

## Source and installation

[PR #87](https://github.com/ThunderKhan/vsph-control-center/pull/87) merged as `cf192315ed2267d0fe38fff6fb315967707047c5`. All four CI jobs passed: 176 Node tests, 47 native PostgreSQL tests and 76 Chromium tests with two intentional skips on both browser launchers. Provider failures, MFA changes, concurrent replacement, issuer drift, logout revocation and protected-account denial are covered by isolated tests.

The reviewed additive migration `20261106063206_internal_employee_temporary_credentials.sql` is installed in configured project `zbmerhexucqxazuxjmmw`. Source SHA256: `f00a1aa0d2df8d4095cf5650829ba2065822bdaf5e6d3f27b46d1a0c1b3394e9`. Transport receipt: `20261106070538` / `vsph_employee_temporary_credentials_20261106`, package SHA256 `d1bfd7707399e0a46d647523baec1e58ef5f1c7b3e9109652203669a9425a9cd`. The transaction used exact prior-history reconciliation, advisory/history locks, two-second lock timeout and sixty-second statement timeout. Do not replay the installer, bootstrap, reset or seed.

All 16 before/after full-row fingerprints match, including Auth users, profiles, customers, subscriptions, CRM, Music, employees, grants and existing enrollment. The new credential table is empty: no real identity, password or email was created/changed. All 48 required tables retain RLS and no browser grants; all 36 required functions have safe server-only execution and fixed search paths. Anonymous live PostgREST table and RPC requests both returned HTTP 401 / SQLSTATE 42501. History reconciles all 35 records (30 canonical migrations and five installation receipts), with no pending source migrations or catalog blockers. [Aggregate evidence](preflight/temporary-credentials-install-20261106.json) contains no credentials or personal records.

## Normal localhost acceptance

1. Pull main, run `npm ci` and restart `npm run dev` at localhost:3000 with existing configuration.
2. Sign in as the existing owner or authorized HR manager. Open **People → Employees → Account link** for a new employee without an active portal identity.
3. Select **Create temporary credentials**. Copy the once-shown login URL, email, random temporary password and expiry. Deliver privately in person or through a trusted private channel. Refresh removes the displayed secret; use explicit reissue if lost.
4. In a separate private browser, the employee opens the normal `/login` and uses those details within 24 hours. They must choose a different personal password and accept the employment link before any portal/product access. Then sign in again with their personal password.
5. Verify only their own employment is visible, HR administration is denied and the temporary password no longer works. Activate roster employment separately for assigned work. Only the owner can appoint HR; HR cannot reset an existing account or assign customer-product permissions through this flow.
6. Verify ready-only reissue invalidates the old password, cancellation denies setup, logout revokes limited setup authority, and existing owner/HR/customer login still works.

## Verification limits and recovery

Live database/catalog and anonymous PostgREST checks passed. Live employee Auth/password/MFA acceptance remains unverified from this session; no real employee identity was created to imply otherwise. Automatic email delivery is not configured or claimed: manual private handoff is implemented. No application deployment, paid resource or hosted restore was performed. Existing provider event-trigger/leaked-password advisor warnings remain separate release gates.

Preservation fingerprints are not a full backup/restore rehearsal. Roll application code back only with the additive schema retained; existing active logins/private invitations remain compatible. Do not drop the table, delete users or reset credentials to roll back. An ambiguous provider write stays disabled/quarantined for governed forward reconciliation; see [credential operations](EMPLOYEE_TEMPORARY_CREDENTIALS.md) and [enrollment recovery](EMPLOYEE_ENROLLMENT.md).
