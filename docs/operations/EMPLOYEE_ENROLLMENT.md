# Employee login enrollment

Creating an employee still saves an idempotent roster record without silently granting account access. The completion screen now links directly to **Set up employee login**. Owners and current HR managers can create a new-account invitation from the employee's Account link page. Existing portal accounts continue through credential/MFA consent linking; their passwords are never reset by enrollment. HR cannot invite protected owner/HR records or appoint HR managers.

## Normal workflow

1. Create the employee and open **Set up employee login**, or use the staff directory's account-link action.
2. Choose **Create login invitation** and confirm the named employee/email. This provisions a new, unconfirmed Auth identity with an unguessable temporary password and a disabled ordinary portal profile.
3. Copy the private setup link shown once. Hand it only to the named employee through a trusted private channel. **No email is sent automatically**, and no SMTP configuration is needed for this manual delivery mode. Never paste the link in GitHub, screenshots, public chats, logs or tickets. It carries password-setup authority.
4. The employee opens the link, reviews their work identity, chooses and confirms a password of 12–128 characters, and accepts the employment account link. Provider password rules also apply.
5. Successful acceptance atomically activates only this new ordinary portal profile, records the employment link and audit, and consumes the invitation. Sign in at the normal portal URL with the exact work email and chosen password. The administrator never chooses or receives that password.
6. Roster status remains **Onboarding** until an authorized manager explicitly activates it in the employee directory. Onboarding accounts can sign in and view their own profile/employment. Active employee workflows require an active roster. Assign projects separately. The platform owner may appoint HR only after activation and accepted identity linkage. Customer/product subscriptions and permissions remain separate.

`PUBLIC_ORIGIN` must be the intended portal origin (for normal local use `http://localhost:3000`). Only HTTPS or localhost HTTP is accepted; request Host/Origin cannot redirect the setup link. A localhost link only works on that computer. Hosting and email delivery are separate operations.

## Lifecycle and recovery

Invitations expire after seven days. Authorized issuers or the owner can cancel, or explicitly reissue an eligible unused invitation with a new random token and version. Reissue invalidates the previous link and retains the originally reserved Auth UUID. Refreshing loses the displayed link; explicitly reissue to get another one. An idempotent replay never returns a second secret. HR may reissue/cancel only their own invitations; owner recovery can replace the issuer explicitly.

Provider creation failures keep a durable provisioning record. Refresh and reissue after resolving the provider outage. An existing unrelated Auth email or profile is never adopted or reset. A conflict requires identity governance/reconciliation. Disabling the new profile or making the roster inactive blocks enrollment; reactivation alone does not restore it.

Acceptance reserves a durable, exclusive acceptance ID before any external password mutation. Other accepts, renewals and replay cannot repeat it. A definitive provider password rejection releases the reservation and lets the employee choose a stronger password. An uncertain timeout, interruption or provider failure leaves `accepting`/`recovery_required`; the profile stays disabled and automatic password retries are blocked. **Do not recycle that lease or enable the profile manually.** A late provider write must not change a password after a later enrollment succeeds.

Operator recovery: inspect the enrollment/version, roster and issuer status, owned Auth UUID and server-side ownership marker. Confirm any outstanding provider operation has ended. Cancel/quarantine the enrollment if identity is uncertain. Retain the disabled identity and audit; do not delete the user, reset an unrelated identity, or retry an ambiguous password write. A governed reconciliation workflow for this exceptional state is a remaining operational requirement; normal issuance and definitive weak-password retry are supported. Completed enrollment cannot be reissued to reset a password. Use existing account-link revocation for accepted employee links; broader account disable remains separate.

## Security and migration

Migration `20261106054740_internal_employee_enrollment.sql` follows the existing employee identity-link and Projects migrations. It adds one RLS-protected server-only table and three server-only functions/triggers. It changes no existing records, roles or credentials. Existing schema installation and provenance rules remain required. Older databases fail closed with an explicit schema-not-ready message; existing consent linking remains available. Source rollback removes the UI/API; preserve enrollment/audit records and disabled identities for forward repair. Do not run bootstrap, seed or reset on an existing database.

Tokens are 256 random bits; SQL retains only SHA-256 hashes. Browser links use fragments, removed immediately by the setup page; secrets are submitted in POST bodies, never query strings or browser storage. Responses are no-store/no-referrer. Profiles stay disabled until a successful database finish; direct ordinary activation cannot bypass incomplete enrollment. External provider tokens and diagnostics never reach the browser. Auth ownership uses immutable planned UUIDs and server-owned app metadata, never user-editable metadata. No employee invitation grants HR, platform owner, tenant membership, product roles or project membership.

All mutations recheck actor/session/issuer authority, roster state/version, purpose, expiry and identity under consistent profile/session/roster/HR locks. Concurrent acceptance and cancellation cannot activate a cancelled link. Existing profile/roster lifecycle controls revoke pending enrollment. Each successful mutation writes an audit event without credentials or capabilities.

## Acceptance evidence

Native PostgreSQL/Express cases cover password setup and login through an explicitly simulated Auth provider, one-winner acceptance, replay, existing identities, invalid fields, cross-role denials, expiry, cancellation, stale roster, profile disable, reissue, provider creation/password failures and browser-role direct SQL denial. Unit tests verify provider ownership and safe issuance replay/origin validation. Chromium covers roster creation through private handoff, password choice, normal login, persistence and forbidden HR/customer access on desktop/mobile. Provider fixtures never become an application mode. Isolated tests do not prove live Supabase Auth or actual email delivery. Hosted installation and live acceptance must be reported separately.
