# VSPH Control Center — Workspace navigation and dashboard

## User-facing screens

The portal provides **two separate routes and views** with a shared responsive shell. The underlying HTML remains `public/dashboard.html`, while Express handles routing and the controller selects the relevant view based on `window.location.pathname`.

| Screen | Clean URL | Purpose | Live sources |
| --- | --- | --- | --- |
| Overview | `/dashboard` | Access summary, tenant roles, workspaces, quick launch, login guidance | `GET /api/auth/me`, `/api/apps`, `/api/workspaces`, `/api/apps/:code/contexts` |
| Applications | `/applications` | Searchable directory of currently authorized products | `GET /api/apps` |
| Platform administration | `/admin` | VSPH super admins: manage customers, products, people, subscriptions, grants, roles and audit events | `/api/admin-management/*` |
| CRM / Music second login | `/apps/:code/login` | Separate application verification and organization selection | Existing app context and auth APIs |
| CRM / Music workspace | `/apps/:code/home` | Tenant-scoped product features | Existing app-specific APIs |

The same route's page content is **not** repeated under Overview and Applications. Overview renders an authorization summary using current customer contexts and individual roles; Applications renders searchable product cards.

## Design

- Uses the company's root `DESIGN.md`: VSPH navy `#00255A`, action blue `#0069C8`, Inter, and restrained neutral cards.
- Carries over the bento layout and subtle spotlight behavior from the supplied inspiration, without fake telemetry.
- Keeps buttons centered and removes decorative arrows.
- On phones, the sidebar becomes an accessible drawer with an overlay and Escape handling.
- Respects `prefers-reduced-motion` and visible keyboard focus.
- Uses `textContent` for all variable API-provided labels; app links are constructed from validated product codes, not arbitrary URLs.

## Administration versus application Super Admin

Platform administration is for **VSPH-level operators** who onboard customer organizations and configure what products, people and permissions they can access. An application-level Super Admin is a role scoped to one product and one customer organization. These roles are deliberately not interchangeable.

The admin page contains an explanation, guided onboarding sequence, and the existing management forms. All actions still require platform Super Admin authorization on the backend.

## Clean routes, with compatibility

The frontend uses `/dashboard`, `/applications`, `/admin`, `/login`, and `/apps/:code/home`. Old links to `/dashboard.html`, `/applications.html`, `/admin.html`, and `/login.html` redirect to their clean paths. Redirects alone are not authorization: Express guards the protected destinations.

## Testing

```powershell
git fetch origin
git switch feat/dashboard-bento-redesign
git pull --ff-only
npm test
npm run check
npm run dev
```

Test `http://localhost:3000/dashboard`, `http://localhost:3000/applications`, and—while logged in as VSPH platform Super Admin—`http://localhost:3000/admin`.

Verify mobile widths 320px, 390px and 768px, CRM-only permissions, app-specific second logins, and legacy URL redirects.

**Scope:** The overview and directory are separated; the platform admin page has clearer purpose and VSPH branding, but its existing management CRUD operations and internal CRM/Music workspaces remain otherwise unchanged.
