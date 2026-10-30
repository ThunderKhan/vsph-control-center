# Workspace dashboard design

This redesign is intentionally **not** a copy of the 21st.dev tech-stack demo. It adapts its bento composition and cursor-following spotlight treatment to VSPH's actual portal workflow.

## Source of truth

- `DESIGN.md`: VSPH palette, typography, component rules, and accessibility.
- `public/dashboard.html`: accessible dashboard markup.
- `public/dashboard.css`: responsive dashboard-specific styles; intentionally separate from admin and shared login CSS.
- `public/dashboard.js`: loads permissions and counts from existing Express/Supabase endpoints.
- `tests/dashboard.test.js`: regression checks for navigation, real data, and permission-filtered cards.

## What is real versus presentational

| UI element | Backend source |
| --- | --- |
| Account name / platform role | `GET /api/auth/me` |
| Available product count and cards | `GET /api/apps` |
| Organization count | `GET /api/workspaces` |
| Product open action | Protected `/apps/:code/login` route |
| Sign out | `POST /api/auth/logout` |

There are **no simulated latency charts, fake status gauges, deployment terminals, or synthetic activity events**. The dashboard only presents what the current API supports.

## Responsiveness and accessibility

- Desktop: VSPH navy sidebar, feature panel with subtle pointer spotlight, two metric cards, and a responsive application grid.
- Tablet/mobile (up to 950px): sidebar becomes a dismissible drawer with a backdrop, Escape handling, and keyboard focus wrap. The content becomes a single column on phones.
- All action labels are centered. Decorative launch arrows were removed.
- Keyboard focus is visible; status labels include text, not color only.
- Motion is optional via `prefers-reduced-motion`.
- Elements are created with `textContent`, not untrusted HTML. Product links are constructed as same-origin `/apps/:code/login` URLs after validating the product code.

## Security

This is a dashboard redesign, not a permissions change. **Express enforces portal authentication and tenant/product entitlements**. `/api/apps` already returns the applications a signed-in user may access, and app login requires its own second authentication step. The frontend does not create new entitlements or expose privileged Supabase credentials.

## Test

```powershell
npm test
npm run check
npm run dev
```

Open `http://localhost:3000/dashboard.html` after signing in. Review the layout at desktop, 768px, 390px, and 320px widths. Verify CRM-only users cannot see Music and cannot bypass Music through a direct URL. Finally check super-admin navigation to `/admin.html`.

## Deliberate scope

The **portal workspace dashboard** was redesigned. The Platform Admin CRUD screens, product-specific CRM/Music workspaces, and backend/database were left unchanged to avoid breaking management workflows. They can be redesigned as separate, smaller PRs using the same VSPH rules.
