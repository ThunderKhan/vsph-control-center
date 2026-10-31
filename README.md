# VSPH Control Center — Supabase edition

Projects MVP, durable provisioning, read-only GitHub delivery, project inbox/reporting and own-session controls are implemented. **Target rollout requires all reviewed ordered migrations through 20261031000700 before deploying this backend. No hosted migration/deployment is implied by a Git merge.** See [Projects guide](docs/operations/PROJECTS_GUIDE.md), [provisioning operations](docs/operations/PROVISIONING_V2.md), and [current execution report](docs/roadmap/IMPLEMENTATION_REPORT.md).

VSPH's multi-tenant product portal (Express + vanilla HTML/JS/CSS), integrated with **Supabase Auth** and **hosted PostgreSQL**. The portal workspace dashboard and login were redesigned with the company design system while retaining the existing backend permissions. The old MySQL integration was replaced.

## Guided customer onboarding — PR #7

Platform administrators use the five-step `/admin/onboarding` wizard. Submission commits a durable idempotent job/tenant/grants/outbox transaction; it does not send email synchronously. `/admin/provisioning` shows delivery/acceptance/failure state and audited retry, revoke and reconciled recovery. A separately invoked worker requires an approved authenticated HTTPS delivery provider, idempotency contract and server-only outbox encryption key. It is disabled by default.

Invitations are purpose-bound, expiring, single-use capabilities for one membership. Newly provisioned identities stay disabled until enrollment completes. Existing accounts must sign in and their passwords are not reset by acceptance. Explicit account disable revokes pending enrollment. Legacy broad bearer invitation links are rejected and must be reconciled before rollout. See [current customer onboarding](docs/CUSTOMER_ONBOARDING.md).

## Internal project delivery

Open `/projects` to create internal/customer engagements, assign accountable owners and project teams, manage milestones/dependencies/tasks/priorities/dates, collect comments/HTTPS deliverables and inspect activity/progress. Project membership is separate from product roles and entitlements. Managers govern work; contributors update assigned task status; viewers and explicitly shared customer viewers are read-only. Mutations validate current access and project version in PostgreSQL with atomic audit. See [usage and API contract](docs/operations/PROJECTS_GUIDE.md).

## Engineering delivery and project operations — Phase 3

Projects → Engineering supports project-specific GitHub App approval, authorized repository discovery/selection, bounded read-only sync, source-linked PR/build/release history and explicit task/milestone links. Tokens stay server-only; the connector is off until an operator configures and installs the least-privilege App. Vercel remains disabled without verified ownership. Live GitHub/Supabase acceptance is unverified; isolated fixture success does not certify it. See [GitHub setup/limits](docs/operations/GITHUB_DELIVERY.md).

Project inbox/reporting provides transactional in-app notifications, preferences/read/retry controls and scoped work/engineering reports. Your active sessions permits private own-session inventory/revocation with product-session cascade. Explicit finite `github:sync` and `notifications:dispatch` commands support scheduling; normal server startup never starts hidden workers or sends customer email. See [notifications/reports](docs/operations/PROJECT_NOTIFICATIONS.md), [sessions](docs/operations/ACCOUNT_SESSIONS.md), [migration readiness](docs/operations/PHASE3_MIGRATIONS.md), [full PowerShell handoff](docs/operations/WINDOWS_HANDOFF.md), and [manual QA](docs/operations/MANUAL_QA.md).

## Music external app launch and central SSO foundation (PR #5)

The portal now has an **allowlisted external launch gateway** (`/apps/MUSIC/launch`) with an organization picker and a back-channel, 60-second, single-use authorization-code exchange. Selected tenant and application role are verified from the current Supabase data **at issue and redemption time**. The Music backend can introspect current tenant permissions and the original live portal session when enforcing its own session.

**Disabled by default:** Without all three `MUSIC_SSO_*` server environment variables, Music still uses the existing local second-login demo and CRM remains unchanged. This is intentional: the separately hosted Music React/Vite prototype still uses browser-side demo authentication and must gain a trusted Vercel receiver, proper server-side sessions, staff/musician roles, and backend API permissions before production activation.

Apply the reviewed `supabase/migrations/20261030_music_sso_launch_codes.sql` migration before enabling. The setup instructions, receiver protocol, role boundaries, test plan and limitations are in **[docs/MUSIC_SSO_INTEGRATION.md](docs/MUSIC_SSO_INTEGRATION.md)**. The SSO flow is a purpose-built initial handshake and should not be marketed as a complete OAuth/OIDC identity provider.

## Music deployment bridge — PR #6

VSPH's Music application card now has two separate actions: **Open application** (always goes through the tenant-checked VSPH launch gateway) and **View deployed Music demo** (opens the publicly supplied URL [vsph-music-system.vercel.app](https://vsph-music-system.vercel.app/) in a separate tab). A public demo link is **not** SSO.

Music gains explicit **staff** and **musician** tenant roles after applying `supabase/migrations/20261030_music_staff_musician_roles.sql`. These roles cannot be assigned to CRM. The VSPH SSO handoff remains off until the actual Music Vercel project deploys its secure receiver and environment variables.

A candidate receiver implementation has been prepared in the accessible `ThunderKhan/taj-santacruz-smart-guest-platform` source repository, but its connection to the supplied Vercel hostname is **unverified**. Do not configure SSO solely on the basis of a working public website. See [Music integration instructions](docs/MUSIC_SSO_INTEGRATION.md).

## Workspace dashboard

The portal offers two **distinct** views in a shared responsive VSPH layout. **Overview** (`/dashboard`) summarizes access by product, customer organization and role using the existing authorization APIs. **Applications** (`/applications`) provides a dedicated searchable directory of authorized products. No simulated metrics are displayed.

Both views share `public/dashboard.html`, `public/dashboard.css`, and `public/dashboard.js`, with separate Express routes. **Platform Administration** (`/admin`) now explains the VSPH super-admin workflow; central administration remains separate from product permissions. Platform administrators need explicit tenant membership and product roles to operate customer products.

See **[docs/DASHBOARD_DESIGN.md](docs/DASHBOARD_DESIGN.md)** for navigation, responsive layout, security, and the design rationale.

## Features

- Portal login using Supabase Auth and a hashed, HTTP-only portal session cookie.
- CRM / Music app cards filtered by organization subscription, grant, membership and individual app role.
- **Mandatory second password verification** inside each app. Creates a separate app-scoped session tied to a specific customer and the current portal session.
- Platform Super Admin console for organizations, application catalog, subscriptions, access grants, users and per-app role assignments.
- Simple tenant-scoped CRM Contacts and Music Requests modules to demonstrate isolated data.
- Optional isolated-demo seed fixtures, never installed by normal startup or feature migrations.
- Backend makes **all** Supabase database calls; browser never receives the secret key.
- RLS enabled; anon and authenticated direct access to app tables is revoked. The server uses a privileged key and **must** enforce tenant scoping on every query. See Security and limitations below.

## Requirements

- Node.js >=20.19 (Linux CI verified; Windows PowerShell commands supplied, native Windows execution unavailable)
- A new [Supabase](https://supabase.com/dashboard) project with its **Project URL**, **publishable key** (or legacy anon key), and **secret key** (or legacy service_role key)
- Internet access from the Node.js server to Supabase
- No local PostgreSQL installation, Docker, or MySQL needed.

## Start on Windows (PowerShell)

1. Extract this ZIP and open the `vsph-control-center` folder in VS Code.
2. In Supabase, create a project. In an approved empty/staging project, review the bootstrap and all ordered migrations. Never run bootstrap or destructive test fixtures on an existing customer database. Reconcile history and follow docs/operations/PROJECTS_GUIDE.md before deploying.
3. In **Project Settings → API Keys** (location may vary in Supabase UI), copy the URL and API keys. Never use the secret key in browser code.
4. In the terminal in the project folder:

```powershell
Copy-Item .env.example .env
notepad .env
```

Replace the placeholders with your values:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
PORT=3000
PUBLIC_ORIGIN=http://localhost:3000
NODE_ENV=development
DEMO_PASSWORD= # Optional isolated bootstrap only; normal startup needs no demo password
```

For older projects, the **anon key** can be used in `SUPABASE_PUBLISHABLE_KEY` and the **service_role key** in `SUPABASE_SECRET_KEY`. **Do not commit `.env` to Git.**

5. Install and run against your approved, migrated environment. Do not seed a customer database:

```powershell
npm ci
npm test
npm run check
npm run dev
```

6. Open **http://localhost:3000** and sign in with your existing approved Supabase account. Legacy demo credentials work only if fixtures were explicitly seeded in an isolated demo project; normal startup creates no users.

The login is served at `/` or `/login` using the shared `views/auth.html` template. Portal routes are `/dashboard` (Overview), `/applications` (Applications directory), and `/admin` (VSPH platform super admins only). CRM and Music use `/apps/:code/login` and `/apps/:code/home`. Legacy `.html` bookmarks redirect to these clean routes, with authentication enforced on the destinations.

**Legacy isolated-demo fixtures only** (not installed by normal start or new migrations; never seed real customer databases):

| Email             | Portal products                   | Organization                                                |
| ----------------- | --------------------------------- | ----------------------------------------------------------- |
| `owner@vsph.test` | CRM + Music, Platform Super Admin | VSPH Internal (only explicitly assigned product workspaces) |
| `crm@vsph.test`   | CRM only                          | Alpha CRM Ltd                                               |
| `beta@vsph.test`  | CRM only                          | Beta CRM Ltd                                                |
| `music@vsph.test` | Music only                        | Music Venue Ltd                                             |
| `both@vsph.test`  | CRM + Music                       | Both Products Ltd                                           |

Seed is idempotent for the expected demo rows. Existing users keep their previous password; changing `DEMO_PASSWORD` does not reset previously created Supabase Auth accounts.

### How to demonstrate the two logins

1. Portal login using `crm@vsph.test` and your password.
2. Only **CRM** appears on its dashboard.
3. Click **Open app**, select Alpha CRM Ltd, and **enter the password again**.
4. Try `music` directly: the server must refuse access.
5. Open a second browser profile for `beta@vsph.test`: its CRM sample contact will differ. API queries always filter by selected `organization_id`.
6. `owner@vsph.test` sees the Platform Admin panel; create a customer, assign applications and per-app user roles.

### Platform administration versus product administration

`/admin` is intended for **VSPH platform super admins** who create customer organizations, manage products and subscriptions, provision users, assign roles, and review audit events. It is **not** the Super Admin screen inside an individual CRM or Music customer workspace. Platform status alone does not grant product access. Customer/product permissions require an explicit active tenant membership and product role, effective subscription and enabled grant. See [product authorization](docs/operations/PRODUCT_AUTHORIZATION.md).

### Returning visitors with an active session

When someone visits `http://localhost:3000/` or `/login`, **Express validates the HTTP-only portal session cookie before it sends the page**. A valid, unexpired session belonging to an active account receives an HTTP `302` redirect to `/dashboard` immediately, without downloading or displaying the sign-in form.

Anonymous visitors, or those with expired, revoked, or disabled-account sessions, receive the normal login screen. The server uses the same validator as its protected routes, so opening a stale cookie cannot trigger a `/login` redirect loop. Sign out remains the way to switch accounts.

Root and login responses use `Cache-Control: no-store` to reduce stale login pages appearing from caches. Application-specific second-stage sign-in remains mandatory and unchanged.

### Direct application URL and authentication behavior

**Direct URL entry never grants access.** The portal session is checked on every request for a product login page, app workspace and protected API. App workspaces and tenant records also require a valid, product-scoped session and the user's current customer entitlement.

| Browser action                                                              | Expected result                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Open `/apps/music/login` without a portal session                           | Redirect to `/login`                                 |
| Open `/apps/music/home` without a portal session                            | Redirect to `/login`                                 |
| Open `/apps/music/home` with a portal session but without the Music session | Redirect to `/apps/music/login` for the second login |
| Open Music with both valid sessions and current permissions                 | Enter the authorized customer workspace              |
| Try `/api/apps/MUSIC/records` without required sessions                     | HTTP 401 JSON response                               |
| Enter `/login` with a valid portal session                                  | Redirect to the dashboard                            |

Visiting `/login` **does not sign a user out**. Existing browser cookies can stay valid for up to four hours; use **Log out** or a fresh private browsing window for a genuinely anonymous test. Protected pages and session-dependent API responses set `Cache-Control: no-store` to reduce stale-content exposure. Product URL routing is not a security boundary; backend authorization is.

### Health and tests

```powershell
npm test
npm run check
```

`http://localhost:3000/api/health` checks basic Supabase connection after configuration.

## Architecture

```
server.js                 Express routes/static hosting
security.js               Cookie sessions, authorization, app context validation
access-policy.js          Pure permission decision logic (unit tested)
db.js                     Server-side Supabase clients
routes/auth.js            Portal and second-stage app login/logout
routes/apps.js            Allowed products + tenant-scoped CRM/Music records
routes/admin-management.js  Platform admin CRUD and app role assignments
routes/workspaces.js      Workspace count
views/auth.html            One shared HTML login template for portal and applications
public/auth-page.js        Shared login controller (portal + app session workflows)
public/auth-config.js      Product/customer branding override registry (presentation only)
public/auth.css            Shared login design with responsive layout
public/                   Dashboard/admin pages and shared browser assets
supabase/schema.sql       Managed Postgres tables, constraints, RLS, product seed
tests/                    Unit tests for access policies and token properties
seed.js                   Create demo identities, tenants, product access
```

## Security and limitations

- The **secret/service-role key bypasses RLS**. It is only stored on the Node backend. Direct database access by browser roles is denied, and backend queries explicitly filter `organization_id`. This is a prototype architecture; a production system should add DB-level tenant enforcement with scoped user JWT / appropriate RLS policies, or protected tenant-aware RPC functions, then penetration-test the boundaries.
- Account creation spans the Supabase Auth service and PostgREST calls, so it is not truly atomic. The client creation endpoint attempts cleanup if later steps fail; production must implement provisioning jobs / retry or a database transaction via a dedicated RPC.
- Demo account credentials should be replaced with individual customer credentials and password reset/onboarding workflows.
- Portal and app sessions expire after 4 hours, are stored hashed, and are tied together; portal logout cascades through app sessions. Process rate limits, self-service revocation, native PostgreSQL and authenticated browser tests exist. Distributed limits, MFA/recovery, real provider/staging UAT, operational restore/load/incident controls remain release gates.
- The `role` check supports viewer as read-only; granular permissions in larger CRM/Music feature sets are not implemented yet.
- No live Supabase keys are bundled; a real connection and database integration testing must be completed in **your own** Supabase project.
- Currently runs as a local Node/Express server. Supabase hosts the database/authentication, **not** this Express frontend/backend. For internet hosting, deploy Node separately (e.g. Render, Railway, Fly.io, Vercel with configuration).
- The old MySQL `.env` (possibly containing credentials), `node_modules` and the obsolete SQL script were **excluded** from the output.

## VSPH design guidelines

`DESIGN.md` at the repository root is the reference for VSPH colors, typography, spacing, accessibility, copy, and logo usage. The **portal, CRM and Music login routes now render the same `views/auth.html` template**, styled by `public/auth.css` and `public/auth-background.js` and controlled by `public/auth-page.js`. The obsolete separate HTML/JS login implementations were removed. For future product or organization-specific appearance, use `public/auth-config.js`; see **[docs/AUTH_THEMING.md](docs/AUTH_THEMING.md)** for examples and the secure structural-override extension point. Other dashboard styling remains in `public/style.css`.

The animated dot grid is a lightweight Canvas adaptation of the supplied Three.js design. It requires no extra dependencies, pauses while the page is hidden, and respects reduced-motion preferences. Existing password authentication and app-scoped sessions are unchanged.
