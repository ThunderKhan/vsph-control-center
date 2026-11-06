# HR-issued temporary employee credentials

Owners and current HR managers can choose **Create temporary credentials** on the employee's Account link page. This is an alternative to the existing private setup invitation. It only enrolls new ordinary employee identities; it never resets an existing active account, assigns products/projects or grants HR authority. Existing identities retain the credential/MFA consent-link workflow. Owner-only HR appointment and explicit roster activation remain separate.

## Handoff and first sign-in

The server generates a strong random temporary password, confirms this newly owned Auth identity and displays the email, password, normal sign-in URL and 24-hour expiry once. HR can copy the details and give them in person or use a trusted private channel. No real email is automatically sent; do not put credentials in tickets, screenshots, repositories, shared mailboxes or public messages. Prefer separate channels for the username and temporary secret. HR should never request the employee's later personal password.

At normal `/login`, provider password/MFA verification produces only an HTTP-only, ten-minute password-setup cookie. The profile remains disabled. No ordinary portal/product session is created. `/dashboard`, APIs, HR tools and customer products are inaccessible. The employee must choose a different personal password and accept the employment link at `/employee-password`. Successful completion atomically consumes setup authority, records consent and activates the ordinary profile. They sign in again with their personal password. The HR-known temporary password then fails. Roster status stays Onboarding until explicitly activated; assignments and HR appointment are separate.

## Expiry, reissue, cancellation and failures

Temporary credentials expire after 24 hours; setup sessions after ten minutes. A fresh temporary sign-in replaces any previous setup cookie. Authorized HR issuers or the platform owner can explicitly reissue **ready, unused** credentials with current versions. Reissue invalidates prior temporary passwords and setup sessions. Reissue cannot run during an in-flight password operation or reset a completed account. Refreshing the administrator page removes displayed secrets; reissue if delivery details were lost.

Cancellation uses the existing governed enrollment cancellation. Profile disable, inactive employment, stale roster, revoked issuer authority and cancelled enrollment deny further setup. The provider password is changed outside the SQL transaction; durable exclusive states prevent competing writes and stale callbacks. Definitive weak-password rejection allows a safe retry. Ambiguous provider failure quarantines the disabled profile; automatic recycling of uncertain leases is prohibited. Consult [enrollment recovery](EMPLOYEE_ENROLLMENT.md). No existing user's password is reset as a recovery shortcut.

SQL stores only temporary-password and setup-cookie hashes, not delivery credentials. Server-owned Auth metadata and immutable reserved UUIDs establish identity ownership. All state/authority/version/expiry checks repeat under profile/session/roster/grant locks. Each mutation is audited without secrets. Browser roles cannot read credential tables or execute the command RPC. Password setup endpoints accept only the restricted cookie, never a browser-supplied user ID or role.

## Migration and acceptance

`20261106063206_internal_employee_temporary_credentials.sql` depends on the existing employee-enrollment migration. It adds one server-only RLS table and command function. It does not backfill/reset existing identities or alter existing tables. Reviewed installation is required before offering this mode; existing active logins and private invitations remain functioning on older targets.

Native PostgreSQL/Express tests cover actual normal-login responses with a simulated Auth provider, missing/revoked credentials, full portal denial before replacement, password reuse denial, one-winner replacement, safe reissue, stale setup cookies, expiry, provider failures, accepted identity linkage and role isolation. Chromium tests exercise the same normal sign-in/forced-change flow on desktop/mobile; existing invitation, employee, product, navigation and governance tests remain required. These are isolated-provider evidence, not a live Auth acceptance or email-delivery claim.

## Related workflow review

Roster-only onboarding, new identity enrollment, existing-account consent, temporary first login, expiry/cancellation/reissue and owner-only HR appointment now have distinct paths. Automated email sending still requires an approved sender/delivery adapter and durable delivery configuration. Existing-account password/MFA recovery must use a separately governed provider recovery flow; HR temporary credentials deliberately cannot take over those accounts. Payroll, statutory calculations and hardware-verified attendance remain outside this credential workflow. No mock sender, fake delivery status or production reset is presented as implemented functionality.
