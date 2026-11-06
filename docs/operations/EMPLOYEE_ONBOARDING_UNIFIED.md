# Unified internal employee onboarding

## Scope

The VSPH Control Center uses its existing Supabase Auth, internal roster,
employee identity-link, credential, and HR governance mechanisms. It **does
not** copy CRM database tables or CRM's cross-organization role model. The
organization owner's customer/product assignments remain separate from
internal workforce access.

The integrated experience is served at `/employees/onboarding`. The
administrator supplies full name, work email, department, title, employment
type, and start date; reviews the saved roster details; and selects an access
method. The **default** is a one-time invitation link. Existing employee
records are preserved and can be managed from `/employees`.

## Available creation methods

- **Invitation (default):** Create a disabled portal identity and a seven-day
  single-use setup link. The employee chooses a password to activate it.
- **Email invitation:** The same invitation, with explicit submission to an
  approved email provider. A manual backup link is shown once.
- **Temporary credentials:** Generate a 24-hour password for private handoff.
  The employee must replace it at their first sign-in.
- **Roster only:** Create the employment record without login credentials.
  Set up access later through governed enrollment or consent linking.

The issuer never chooses the final employee password in the invitation
flow. The temporary-password flow forces a personal password before any
ordinary portal session is granted. Neither workflow grants HR, owner,
customer, project, or product access. A new roster remains **Onboarding**
until the authorized manager explicitly activates it.

The account-link page at `/employees/:id/account-link` retains invitation
review, cancellation, reissue, existing-account consent, and credential
reissue. Only authorized owners and current HR managers can issue ordinary
employee access. HR cannot appoint HR or change protected owner/HR records.

## Optional invitation email

The following **server-only** environment variables configure an approved
outbound mail webhook:

```ini
EMPLOYEE_INVITATION_EMAIL_WEBHOOK_URL=https://mailer.example.test/send
EMPLOYEE_INVITATION_EMAIL_WEBHOOK_TOKEN=SERVER_ONLY_TOKEN
```

The backend sends an authenticated HTTPS `POST` (or loopback HTTP in
development only) with JSON properties `to`, `subject`, `text`, and
`type: "employee_invitation"`. The provider is responsible for the
actual email infrastructure, suppression lists, bounces, and delivery
tracking. Do not configure an untrusted endpoint; it receives the
single-use setup capability. These settings are distinct from the
customer invitation dispatcher settings.

Email is **opt-in**. With no approved webhook, the manual invitation
option works normally, while email mode returns `EMAIL_NOT_CONFIGURED`
before consuming an invitation. A 2xx webhook response means **request
submitted**, not confirmed mailbox delivery. A failed or timed-out
webhook request leaves the new link available for private manual
handoff with a clear warning. The server does not automatically retry
an uncertain email request.

Plaintext invitation tokens are never stored in SQL. On an existing
pending invitation, the original raw link cannot be recovered from
its hash. To send that invitation by email **later**, an authorized
issuer opens the employee's account-link page and explicitly uses
**Reissue and email invitation** after configuring the provider. This
invalidates the old link. Idempotent replays do not regenerate or
redisclose an invitation secret.

## Operational recovery and safety

If an enrollment call fails **after** the roster is created, the UI
shows a saved-roster confirmation and a link to review or recover its
identity state. Do not create a duplicate employee or blindly retry
an uncertain Supabase Auth password operation. Existing durable states
such as `recovery_required` stay disabled until governed reconciliation.

Existing accounts with the same email continue through consent-based
identity linking; enrollment cannot take over their passwords.
Only server-side service-role RPCs may create the employee Auth identity,
and the existing RLS policies, verified issuer sessions, and SQL locks
remain the authorization boundary.

This release adds **no database migration**, resets no credentials,
does not touch existing users, and does not deploy or configure
an outbound email provider automatically.

## Validation

Run `npm test`, `npm run lint`, `npm run check`,
`npm run check:migrations`, and the isolated database and browser
suites through the existing GitHub Actions checks. The core browser
test covers invitation-first onboarding, one-time link handoff,
password acceptance, and denied HR/customer access. The roster-only
test deliberately selects the no-login option. Unit tests exercise
email opt-in, unsafe endpoint rejection, simulated provider acceptance,
and failure reporting.

A live provider delivery test and a live Supabase Auth acceptance
test require explicit authorization and a designated real test user.
Passing isolated simulations must not be described as live delivery
verification.
