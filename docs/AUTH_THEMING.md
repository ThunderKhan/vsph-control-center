# Shared VSPH login system

The portal, CRM and Music login pages use **one reusable view**, **one browser controller**, and **one stylesheet**. The application login is still a separate authentication step; sharing UI never shares or bypasses permissions.

## Files

| File | Responsibility |
|---|---|
| `views/auth.html` | Single HTML layout with shared form, hero and password eye icon |
| `public/auth-page.js` | Detects portal versus `/apps/:code/login`; submits the correct API request |
| `public/auth-config.js` | Optional product- and organization-level **presentation** overrides |
| `public/auth.css` | One VSPH responsive design and theme variables |
| `public/auth-background.js` | Animated dot-grid, including reduced-motion handling |
| `server.js` | Renders the shared view, checks portal session and product access before showing application login |
| `routes/auth.js` | Independently verifies credentials and issues portal or product-specific session cookies |

## Routes and security

- **`/`** and **`/login`** display the shared view in portal mode. Submit calls `POST /api/auth/login`, then opens the dashboard.
- **`/apps/crm/login`** and **`/apps/music/login`** display the **same** shared view in app mode. Express checks the portal session and user's product access before rendering. The controller loads authorized organization contexts from `GET /api/apps/:code/contexts`.
- The customer picker appears only in app mode. Submitting calls `POST /api/auth/app-login`, which **re-verifies password, portal account, customer membership and app-specific role** before starting an app-scoped session.
- The client-side route detection and theme configuration are **not authorization mechanisms**. The backend still enforces all permission and tenant boundaries.
- `/login.html` redirects to `/login`; old duplicate login files were removed.

## Customizing a product's login

In `public/auth-config.js`, edit the `apps` mapping:

```js
apps: {
  CRM: {
    heroKicker: 'CRM WORKSPACE',
    formDescription: 'Confirm your password to open CRM.',
    action: '#0069C8'
  }
}
```

Unspecified values inherit the VSPH defaults. Set `layout: 'focused'` for a compact, centered login instead of the default `layout: 'split'`. Both use the same HTML and controller. Supported text keys: `heroKicker`, `heroLineOne`, `heroLineTwo`, `heroDescription`, `cardKicker`, `formHeading`, `formDescription`. Color keys: `background`, `action`, `highlight`.

## Customizing for one customer

After the user chooses an authorized organization, the controller applies an optional entry keyed by `APP_CODE:ORGANIZATION_UUID`:

```js
organizations: {
  'CRM:00000000-0000-0000-0000-000000000001': {
    heroKicker: 'CLIENT WORKSPACE',
    action: '#0069C8'
  }
}
```

Use actual organization IDs from your database; this example UUID is not real. **Do not put secrets or authorization rules in these browser-readable settings.** Do not use a user's choice of theme to infer entitlement.

If a customer later needs a **structurally different layout**, `server.js` has an explicit `authViews` allowlist (currently empty). Add a reviewed custom view outside `public/` and map a product code there. Do not accept a view path from a request or database value. Keep password submission and app-scoped authorization in the backend unchanged.

## Design and testing

Follow root `DESIGN.md` for brand typography, color contrast and layout. Keep the main sign-in action centered and the password eye accessible. At normal desktop heights, the page is one viewport; exceptionally short/zoomed screens and mobile are permitted to scroll rather than clip controls.

```powershell
npm test
npm run check
npm run dev
```

Test the portal first, then CRM and Music, with the demo accounts that have different product entitlements. Verify that manually opening a product URL without access still fails.
