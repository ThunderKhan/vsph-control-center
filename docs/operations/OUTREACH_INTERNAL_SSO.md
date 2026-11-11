# Internal Outreach SSO — Phase 4 source integration

**Status: source-only, not applied to hosted Supabase, not deployed or staging
accepted.** Existing Music SSO is unchanged. This is an independent internal
employee launch, not a copied customer/tenant login.

## Contract and ownership

- VSPH Control Center remains the employee identity and portal session
  authority. Outreach Manager maintains its own Postgres session table and
  local domain-specific RBAC. Neither database writes directly to the other.
- Registered product code: `OUTREACH`; client ID: `outreach-internal`.
  An active product registry entry is a **separate prerequisite**, not proof of
  employee authorization. No employee is auto-granted by this migration.
- `outreach_staff_grants` is owner-governed and RLS protected. Roles:
  `administrator`, `manager`, `representative`, `analyst`. Any role
  requires an explicit enabled grant and current active portal session.
  Ordinary employees additionally require an accepted linked identity whose
  roster is currently **active** and whose work email matches their profile.
  A platform super admin can receive an explicit grant without a roster
  link, but does NOT inherit Outreach access by being platform owner.
  Customer memberships, organization subscriptions and project role grants
  provide **no** Outreach authority.
- Grant/revoke uses an owner/session-checked service-only PostgreSQL RPC with
  audit records; administrative page: `/admin/outreach-access`.
  Owner may revoke a grant even after the target profile is disabled.
- With complete, server-owned configuration, `/apps/outreach/launch`
  verifies the current internal grant then redirects to an **allowlisted**
  Outreach `/api/v1/sso/start` endpoint. No untrusted redirect URL is
  accepted from the product registry or browser.

## Authentication flow

1. Employee signs in normally on VSPH, opens assigned Outreach card.
2. Outreach backend generates random `state` and a PKCE S256 verifier.
   It binds both and short expiry to that browser using a signed, HttpOnly,
   SameSite=Lax pending cookie. No VSPH access credential is exposed.
3. Employee browser visits VSPH
   `GET /api/outreach-sso/authorize?client_id=outreach-internal&app=OUTREACH&state=...&code_challenge=...&code_challenge_method=S256`.
   VSPH validates existing portal cookie, current employment/grant, active
   registry and writes a hashed single-use **60-second** code via
   `outreach_issue_code`.
4. VSPH redirects to only the fixed
   `OUTREACH_SSO_CALLBACK_URL` with code and state. Outreach compares
   state and signed pending cookie in constant time and consumes it.
5. Outreach server exchanges the code confidentially via
   `POST /api/outreach-sso/exchange` with a server-only client secret and
   original PKCE verifier. VSPH atomically consumes the code and rechecks
   portal session, active profile, grant and employment via
   `outreach_consume_code`.
6. Outreach issues a distinct short-lived HttpOnly session cookie whose
   random token is stored **only hashed** in Outreach Postgres.
   `portal_session_ref` remains confidential in this table, never in a
   browser-readable token, URL, logging event or LocalStorage.
7. Outreach calls `POST /api/outreach-sso/introspect` server-to-server
   on every protected request. VSPH recomputes the current role and active
   grant from the original portal session. Outage, logout, disabled profile,
   removed grant, inactive employment and missing registry all **deny** new
   protected requests. Role changes take effect on the next request.

This is a dedicated confidential launch, **not** a public OIDC issuer or
OAuth authorization service. Do not advertise it as standards-compliant OIDC.

## Database registration and setup (explicit, reviewed, not automatic)

1. Reconcile the canonical migration manifest and existing hosted ledger.
   Confirm prerequisites: internal employees, account links, portal sessions
   and governed product registry; verify encrypted backup/restore evidence.
2. Apply only reviewed forward migration
   `20261111100000_outreach_internal_sso.sql` through the approved database
   release process to the correct environment. This session has **not**
   applied it. Never replay `schema.sql`, demo seeds or an existing migration.
3. As VSPH platform owner, register `OUTREACH` through the existing
   `/admin/products` governed registry, with status `active`, visibility
   `listed`, integration mode `portal_only`, and derived route
   `/apps/outreach/login`. **Registration alone grants nobody access.**
4. Configure server environment only after a tested Outreach receiver exists.
   On VSPH server:
   ```dotenv
   OUTREACH_SSO_START_URL=https://outreach.example.test/api/v1/sso/start
   OUTREACH_SSO_CALLBACK_URL=https://outreach.example.test/api/v1/sso/callback
   OUTREACH_SSO_CLIENT_SECRET=<random-secret-at-least-32-chars>
   ```
   The receiver's `VSPH_CLIENT_SECRET` must match; no secrets belong in Git
   or browser variables. Production URLs must be HTTPS, share the same
   stable Outreach origin, and have exactly these configured paths.
5. Grant staff through `/admin/outreach-access` **after** confirming
   their accepted employment account link and need-to-know role.
   Use independent representative and manager accounts to test approvals.
6. Enable Outreach's separate `AUTH_MODE=vsph_confidential` only in a
   controlled staging deployment. Keep `SENDING_ENABLED=false`.
   Verify navigation, employee sign-in, revocation, role changes and outage
   behavior. Do not enable in production until signed acceptance.

## Server routes

- `GET /api/outreach-sso/authorize`: portal-cookie-protected code issuance
- `POST /api/outreach-sso/exchange`: confidential, atomically consumed code
- `POST /api/outreach-sso/introspect`: confidential live grant/session check
- `GET /api/admin-management/outreach-access`: owner-scoped grant inventory
- `PUT /api/admin-management/outreach-access/:id`: explicit role grant
  (`{role}` body)
- `DELETE /api/admin-management/outreach-access/:id`: revoke
- `GET /apps/outreach/launch`: protected, server-owned launch redirect

The backchannel exchanges are mounted **before** browser Origin validation
and require a confidential secret; authorization and grant writes remain
protected by portal cookies and normal Origin validation.

## Deferred final test/release gates

Per project-owner request, tests have been **authored but not executed** in
this implementation pass. Before staged acceptance, run:
`npm ci`, `npm run check:migrations`, `npm test`, `npm run lint`,
`npm run check`, isolated native DB cases, end-to-end browser tests and a
migration/restore rehearsal. Add failure-injection for concurrent code
redeeming, deactivated employment, owner privilege changes, revoked portal
sessions, open-redirect attempts and VSPH service outages. Confirm current
production hosted schema before applying anything.

Existing Control Center open PRs #103 and #104 are not part of this integration
and were not merged or rebased here.

**Rollback:** unset OUTREACH SSO config, disable the OUTREACH application,
revoke grants via audited UI; leave forward-only tables and audit history
intact. Deleting the Outreach application is not an appropriate rollback.
