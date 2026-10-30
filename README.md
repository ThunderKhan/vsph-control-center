# VSPH Control Center — Supabase edition

VSPH's multi-tenant product portal (Express + vanilla HTML/JS/CSS), integrated with **Supabase Auth** and **hosted PostgreSQL**. The portal workspace dashboard and login were redesigned with the company design system while retaining the existing backend permissions. The old MySQL integration was replaced.

## Workspace dashboard

The portal dashboard has a responsive VSPH bento layout based on the actual authorized applications and organizations. It incorporates a restrained hover spotlight concept from a 21st.dev reference, but no fabricated metrics or unrelated technical demos. The new UI lives in `public/dashboard`, `public/dashboard.css`, and `public/dashboard.js`. The administrator management pages and all Supabase APIs remain unchanged.

See **[docs/DASHBOARD_DESIGN.md](docs/DASHBOARD_DESIGN.md)** for layout, accessibility, data-source mapping, tests, and scope.

## Features

- Portal login using Supabase Auth and a hashed, HTTP-only portal session cookie.
- CRM / Music app cards filtered by organization subscription, grant, membership and individual app role.
- **Mandatory second password verification** inside each app. Creates a separate app-scoped session tied to a specific customer and the current portal session.
- Platform Super Admin console for organizations, application catalog, subscriptions, access grants, users and per-app role assignments.
- Simple tenant-scoped CRM Contacts and Music Requests modules to demonstrate isolated data.
- Five demo users and multiple organizations including two distinct CRM customers.
- Backend makes **all** Supabase database calls; browser never receives the secret key.
- RLS enabled; anon and authenticated direct access to app tables is revoked. The server uses a privileged key and **must** enforce tenant scoping on every query. See Security and limitations below.

## Requirements

- Node.js 20+ (Windows PowerShell is supported)
- A new [Supabase](https://supabase.com/dashboard) project with its **Project URL**, **publishable key** (or legacy anon key), and **secret key** (or legacy service_role key)
- Internet access from the Node.js server to Supabase
- No local PostgreSQL installation, Docker, or MySQL needed.

## Start on Windows (PowerShell)

1. Extract this ZIP and open the `vsph-control-center` folder in VS Code.
2. In Supabase, create a project. In **SQL Editor**, paste and run `supabase/schema.sql`. (Only do this on a new project.)
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
DEMO_PASSWORD=choose-a-unique-12-plus-character-password
```

For older projects, the **anon key** can be used in `SUPABASE_PUBLISHABLE_KEY` and the **service_role key** in `SUPABASE_SECRET_KEY`. **Do not commit `.env` to Git.**

5. Install and seed:

```powershell
npm install
npm test
npm run seed
npm run dev
```

6. Open **http://localhost:3000** and sign into the portal with `owner@vsph.test` and your `DEMO_PASSWORD`.

The login view is served at **`/`** (default) or **`/login`**. The previous `/login.html` address redirects to `/login` for compatibility. The underlying login template remains `public/login.html`; the clean route is handled by Express, not by changing frameworks.

**Demo accounts** (all use `DEMO_PASSWORD` at first creation):

| Email | Portal products | Organization |
| --- | --- | --- |
| `owner@vsph.test` | CRM + Music, Platform Super Admin | VSPH Internal (can select other customer workspaces) |
| `crm@vsph.test` | CRM only | Alpha CRM Ltd |
| `beta@vsph.test` | CRM only | Beta CRM Ltd |
| `music@vsph.test` | Music only | Music Venue Ltd |
| `both@vsph.test` | CRM + Music | Both Products Ltd |

Seed is idempotent for the expected demo rows. Existing users keep their previous password; changing `DEMO_PASSWORD` does not reset previously created Supabase Auth accounts.

### How to demonstrate the two logins

1. Portal login using `crm@vsph.test` and your password.
2. Only **CRM** appears on its dashboard.
3. Click **Open app**, select Alpha CRM Ltd, and **enter the password again**.
4. Try `music` directly: the server must refuse access.
5. Open a second browser profile for `beta@vsph.test`: its CRM sample contact will differ. API queries always filter by selected `organization_id`.
6. `owner@vsph.test` sees the Platform Admin panel; create a customer, assign applications and per-app user roles.

### Direct application URL and authentication behavior

**Direct URL entry never grants access.** The portal session is checked on every request for a product login page, app workspace and protected API. App workspaces and tenant records also require a valid, product-scoped session and the user's current customer entitlement.

| Browser action | Expected result |
| --- | --- |
| Open `/apps/music/login` without a portal session | Redirect to `/login` |
| Open `/apps/music/home` without a portal session | Redirect to `/login` |
| Open `/apps/music/home` with a portal session but without the Music session | Redirect to `/apps/music/login` for the second login |
| Open Music with both valid sessions and current permissions | Enter the authorized customer workspace |
| Try `/api/apps/MUSIC/records` without required sessions | HTTP 401 JSON response |
| Enter `/login` with a valid portal session | Redirect to the dashboard |

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
- Portal and app sessions expire after 4 hours, are stored hashed, and are tied together; portal logout cascades through app sessions. For production, add rate limiting, refresh flows, MFA, operational logging, backups and automated end-to-end tests.
- The `role` check supports viewer as read-only; granular permissions in larger CRM/Music feature sets are not implemented yet.
- No live Supabase keys are bundled; a real connection and database integration testing must be completed in **your own** Supabase project.
- Currently runs as a local Node/Express server. Supabase hosts the database/authentication, **not** this Express frontend/backend. For internet hosting, deploy Node separately (e.g. Render, Railway, Fly.io, Vercel with configuration).
- The old MySQL `.env` (possibly containing credentials), `node_modules` and the obsolete SQL script were **excluded** from the output.

## VSPH design guidelines

`DESIGN.md` at the repository root is the reference for VSPH colors, typography, spacing, accessibility, copy, and logo usage. The **portal, CRM and Music login routes now render the same `views/auth.html` template**, styled by `public/auth.css` and `public/auth-background.js` and controlled by `public/auth-page.js`. The obsolete separate HTML/JS login implementations were removed. For future product or organization-specific appearance, use `public/auth-config.js`; see **[docs/AUTH_THEMING.md](docs/AUTH_THEMING.md)** for examples and the secure structural-override extension point. Other dashboard styling remains in `public/style.css`.

The animated dot grid is a lightweight Canvas adaptation of the supplied Three.js design. It requires no extra dependencies, pauses while the page is hidden, and respects reduced-motion preferences. Existing password authentication and app-scoped sessions are unchanged.
