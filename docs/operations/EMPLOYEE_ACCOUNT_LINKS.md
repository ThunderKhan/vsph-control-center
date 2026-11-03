# Existing employee account consent

The employee roster now supports a durable request/accept/revoke workflow for **existing active ordinary portal identities**. It does not create an Auth user, send an email, reset a password, activate employment or grant a customer, product, project or HR role. New-identity email invitations remain a separate unimplemented workflow; no customer invitation purpose is reused.

## Manager and employee flow

1. Owner/current HR creates or selects a roster record with normalized work email. Its status must be Onboarding or Active, with an existing active ordinary portal account matching that email exactly. Ambiguous/legacy email normalization requires review, not automatic profile rewriting.
2. Open Account link from the employee row. Review the current roster version, then request consent. The UUID idempotency key prevents duplicate request retries; another pending request conflicts. No email or bearer link is sent.
3. The employee signs into that existing account and opens My employment from navigation. Only their eligible pending requests and minimal linked employment record are returned.
4. Accept with fresh password and any enrolled supported TOTP. Credentials and provider tokens never persist in the browser or link tables. Existing server-side verification uses a fresh provider client and explicit local-scope cleanup; it does not revoke other provider sessions.
5. Link acceptance alone grants no access roles. The HTTP grant path uses the new consent RPC and fails closed on an older/missing schema; it never falls back to the historical email-only grant. An owner can separately grant HR to an Active employee only after accepted consent. Existing HR assignments predating this migration are preserved for explicit owner review; after revocation/regrant the new consent requirement applies.

## Authorization and lifecycle

Requests are purpose-bound to `internal_employee_link`, employee, immutable candidate ID/email, current roster version and issuer. Seven-day expiry is enforced with database clock time. Renewing increments the request version and binds the current roster; old versions deny. Owner renewal of an HR-issued request explicitly becomes a new owner-approved issuance. Cancellation, expiry, wrong identity, changed email/status, stale versions, revoked sessions and lost issuer authority deny acceptance. A request UUID is never an authentication capability.

All mutations lock profiles in platform-first order, current portal session, roster UUIDs, then HR grants before request/link changes. Provider verification completes outside the DB transaction; the acceptance transaction rechecks current session/expiry, identity, issuer authority, request and roster versions, and the server-only verification timestamp after lock waits. It atomically writes consent and audit. Competing accepts cannot create duplicate consent or audit. A lost response requires refreshing current state; no role or account is silently reactivated.

HR may manage ordinary targets and their own requests, not owner/HR-protected records or another issuer's request. Owners can review/renew/cancel requests under current authority. Account-link revocation removes the linked HR assignment, invalidates its reviewed roster version and audits atomically. Roster inactivation or profile disable/email change also revokes pending/accepted links and HR authority; later reactivation restores none. It does not disable an unrelated portal/customer identity or remove independently assigned tenant, product or project roles. Full offboarding impact review for those assignments remains future work.

Tables are RLS-enabled with direct browser-role access denied. All RPC/helpers/triggers use fixed empty search paths and explicit EXECUTE restrictions. Backend requests derive actor/session/verification metadata; forged browser roles, actor IDs, session hashes, assurance and verification times are rejected. No `user_metadata` claim authorizes anything. Reads expose at most 20 requests; manager history prioritizes current pending work, personal records never reveal another employee's directory or request. Unread/failed requests clear the UI and are retryable. This is not universal privileged-action MFA, MFA enrollment or recovery.

## Migration and rollout

CLI-generated `20261103165522_internal_employee_identity_links.sql` depends on the HR lock-order repair. It adds two tables, purpose/identity/session checks, lifecycle revocation triggers and a stronger gate for **new** HR grants. It does not backfill accepted consent, create users, change historical checksums or rewrite employee/customer records. Review existing HR grants as legacy; this migration preserves them.

The manifest now has 22 source migrations plus canonical baseline (23 journal entries). This migration is source-only/unapplied hosted. Based on the last read-only 19-entry ledger, search, HR repair, this account-link migration and finance are four missing identities. Hosted state was not re-inspected in this increment. No deployment/target write, real Auth/email request, credential, paid resource or plan change occurred. Normal runtime needs the reviewed target migration; isolated test helpers install only into disposable loopback databases. Never replay bootstrap/seeds/legacy installation or rewrite an installed journal.

Rollback frontend/routes first if needed. Keep the additive tables/history and stricter HR gate; do not regrant a private core or silently re-enable email-only HR grants. Any SQL repair must be reviewed as a forward migration. If Auth is unavailable, acceptance fails without a link; retry after recovery. If the roster changed, a manager must explicitly renew. Requests/cancelled/revoked history is retained; a bounded retention policy is still needed.

## Acceptance scope

Native PostgreSQL tests cover purpose/role/session/version/expiry/replay/renewal/cancellation, issuer revocation, wrong identity, concurrency, offboarding/profile-disable and audit rollback. Database-backed Express tests verify fresh credentials/TOTP and forged metadata denial using an explicit fake Auth provider. Authenticated desktop/mobile Chromium exercises owner request, employee consent/MFA, durable reload, separate HR grant, revocation and surviving ordinary portal access. These prove isolated application behavior, not live Supabase Auth/PostgREST, real delivery or hosted migration verification.
