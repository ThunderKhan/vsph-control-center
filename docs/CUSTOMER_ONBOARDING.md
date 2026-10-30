# Customer onboarding wizard

## What it does

Platform Super Admins can open `/admin/onboarding` from the **New customer / Start onboarding** actions in `/admin`. The flow provisions a new VSPH organization and requests an administrator invitation without asking VSPH staff to choose the customer's password.

Five stages:

1. **Organization** — display name and unique lowercase slug.
2. **Administrator** — new administrator name and email. Existing users are rejected with guidance to use ordinary access controls.
3. **Applications** — choose one or more active, authorized product catalog entries.
4. **Subscriptions** — choose each product's `plan_code`, `trial` or `active` status, and optional active / mandatory trial end date; all selected products receive enabled access grants.
5. **Review** — confirm all details and submit once.

The backend `POST /api/admin-management/onboardings` validates all fields and product IDs, creates the organization, calls `Supabase Auth admin.inviteUserByEmail`, creates an owner membership with status **`invited`**, provisions product-specific `super_admin` roles and subscriptions, and writes an audit event. **The customer cannot access the workspace until the invitation is accepted.**

Supabase Auth sends the invitation email; a successful API response means the invitation request was accepted, **not that an email has necessarily been delivered or read**.

## Invitation acceptance

- The administrator opens a Supabase invite email link configured to redirect to `PUBLIC_ORIGIN/accept-invite`.
- The page reads the short-lived `access_token` from the **URL fragment**, removes the fragment from browser history, and sends that token with a new 12–128 character password to `POST /api/invitations/accept`.
- The server calls `Supabase Auth getUser(accessToken)` to verify the bearer token. It never trusts a user ID, email, organization or role from the browser.
- If an active VSPH profile exists and has at least one pending `invited` organization membership, the server sets the password using trusted Supabase admin APIs and activates those pending memberships.
- The invitee then signs in at `/login`. Existing portal and product-session protections continue unchanged.

**Supabase configuration required:**
- Add your exact `PUBLIC_ORIGIN/accept-invite` (e.g. `http://localhost:3000/accept-invite` during local development) to **Auth > URL Configuration > Redirect URLs**.
- Configure a working SMTP provider for administrator invitation delivery. Supabase's default email sending quotas may not be suitable for a production onboarding service.
- The standard Supabase implicit invite redirect must contain the authorization token in the URL fragment; if your project customizes the invite email template or uses a PKCE callback that provides an authorization code instead, you must adapt the callback to exchange/verify that flow **before activation**.
- `PUBLIC_ORIGIN` must be a genuine HTTPS origin for production. Only loopback HTTP is allowed in development. No Supabase secret/service-role key should appear in browser JavaScript.

## Security, rollback, and operational limitations

- Both `/admin/onboarding` and `/api/admin-management/onboardings` require a valid VSPH platform session **and** `platform_role='super_admin'`. Origin validation protects the write API.
- Slugs, emails, product IDs, plans, dates, active apps and duplicate assignments are validated again on the backend.
- The email invitation and Supabase REST inserts **are not one database transaction**. On a partial provisioning error the server attempts to delete the newly created organization and invited auth user. If cleanup fails, the API reports manual intervention rather than claiming success. A previously emailed invitation may no longer be valid.
- There is no payment processing or automatic contract generation. Trial/active status is an authorization/business state, not a billable charge.
- The wizard currently only invites **new** users. Existing VSPH accounts should be attached through the existing roles/access management workflow.
- The old `POST /api/admin-management/clients` endpoint remains available for existing API consumers; the admin UI now promotes the invitation workflow instead. Migrating or deprecating legacy provisioning is a separate compatibility decision.
- There is no durable resumable draft; changing pages before submission loses the wizard values. This is indicated in the UI.
- For production use, implement administrator invitation resend/recovery, idempotency keys, pending invitation reporting and stronger cross-service reconciliation before onboarding at scale.

## Local verification

```powershell
git fetch origin
git switch --track origin/feat/customer-onboarding-wizard
npm ci
npm test
npm run check
npm run dev
```

Sign in as a platform Super Admin → `http://localhost:3000/admin` → **New customer**. Choose unique organization/email, one or more products, valid plan/status/end dates, and review. Confirm pending membership and role records server-side. When SMTP/redirect settings are ready, test the email acceptance end-to-end with a disposable test account.

Negative tests include a duplicated slug/email, inactive product, duplicate product, an expired trial, malformed invitation bearer, and failed invitation delivery. Avoid using actual customer emails during test runs until SMTP is ready.
