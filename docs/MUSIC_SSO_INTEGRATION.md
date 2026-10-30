# Music integration & SSO launch contract — PR #5

## Read this before enabling

**This PR provides the VSPH/Express authorization server half of a cross-origin SSO foundation, NOT a finished production login for the separately deployed Music application.** The Music React/Vite repository currently uses demo browser credentials and localStorage; its staff/musician controls are not protected by a production backend. DO NOT configure the Music launch URL until a trusted backend receiver has been deployed and its protected APIs enforce these roles.

An external Music deployment must have a **server-side** `/api/sso/start` and `/api/sso/callback`, a durable Music session store, and server-enforced authorization. The portal cookie must NEVER be forwarded to Music.

## User flow

1. User signs in centrally via `/login` (existing Supabase-backed portal session).
2. User clicks **Open application** in Overview or Applications. Requests go to `/apps/music/launch`, protected by `portalSession` and `getContexts`. Until Music is configured, this redirects to the original `/apps/music/login` flow.
3. When configured, the dedicated VSPH launch page loads eligible organizations and **actual roles** from `GET /api/sso/config/MUSIC`. The user selects one organization.
4. Browser navigates to trusted Music `/api/sso/start?organization_id=UUID`. **Music's server** generates a fresh cryptographically random state and PKCE `code_verifier` (32 random bytes, base64url), stores them in a securely signed/encrypted, HttpOnly, Secure, SameSite=Lax cookie bound to this browser, and redirects to VSPH:
   `GET https://portal.example.test/api/sso/authorize?client_id=music-vercel&app=MUSIC&organization_id=UUID&state=...&code_challenge=...&code_challenge_method=S256`
5. VSPH validates the existing **portal cookie**, active application and subscription, organization membership, current app role, client ID, state and code challenge; creates a 60-second **hashed, one-use code**; and sends a 303 redirect to **only** the configured callback URL:
   `https://music.example.test/api/sso/callback?code=...&state=...`.
6. The Music backend validates the `state` using the HttpOnly browser cookie (constant-time comparison), reads the corresponding verifier, and exchanges `code` **server to server**:
   ```http
   POST https://portal.example.test/api/sso/exchange
   Content-Type: application/json
   X-VSPH-Client-Secret: <music-server-only-secret>

   {"client_id":"music-vercel","code":"<opaque-code>","code_verifier":"<PKCE-verifier>"}
   ```
7. VSPH **atomically consumes** the code in Postgres, checks the S256 verifier and confidential client secret, and **rechecks** the portal session, user account, live subscription, application grant, membership and role. It returns only:
   ```json
   {
     "user":{"id":"UUID","email":"person@example.test","name":"Example User"},
     "application":{"code":"MUSIC","id":"UUID"},
     "organization":{"id":"UUID","name":"Authorized Venue"},
     "role":"manager"
   }
   ```
8. Music's server issues a **new HttpOnly Secure Music session cookie** with a tenant-scoped server-side session. Clear authorization code and state from the browser address bar via 303 redirect to an app route, and set `Cache-Control: no-store`, `Referrer-Policy: no-referrer` on the callback and server responses.
9. Music enforces the received tenant ID + role for **every** protected API request; it must also detect revocation, e.g. short session lifetime and/or periodic calls to a trusted entitlement validation service. The portal's Music demo cannot substitute for this.

## Configuration

In **VSPH server** `.env` (never frontend, Git, or Vercel public variables):

```dotenv
MUSIC_SSO_START_URL=https://music.example.test/api/sso/start
MUSIC_SSO_CALLBACK_URL=https://music.example.test/api/sso/callback
MUSIC_SSO_CLIENT_SECRET=<random-64-character-secret>
```

Use the **actual** production Music hostname (not preview deployments) for both URLs. This is a fixed allowlist, *not* a client-provided return URL. In production only HTTPS endpoints are accepted. Loopback HTTP is allowed in non-production for integration tests. All three values are required to enable the external launch path; partial/unsafe configuration **fails closed**.

The **Music server** needs:

```dotenv
VSPH_PORTAL_ORIGIN=https://portal.example.test
VSPH_CLIENT_ID=music-vercel
VSPH_CLIENT_SECRET=<same-random-secret>
MUSIC_SESSION_SECRET=<different-random-secret>
```

These values belong in Vercel **server environment variables** / Functions, NEVER `VITE_*` or `NEXT_PUBLIC_*`. Share credentials through a secure deployment secret manager. If the app URL is a protected Vercel preview deployment, deploy to an approved stable production/staging host instead.

## Database installation

Apply `supabase/migrations/20261030_music_sso_launch_codes.sql` **once** to the existing VSPH Supabase project through a reviewed migration process. The existing `supabase/schema.sql` is a bootstrap schema: do **not** rerun it on production data. The new migration creates a service-role-only, RLS-protected `sso_launch_codes` table and a PostgreSQL **DELETE ... RETURNING** function to prevent code replay.

Clean up expired codes periodically (`DELETE FROM public.sso_launch_codes WHERE expires_at < now()`) from a trusted DB job.

## Trust and role boundaries

- The selected `organization_id` is **not** authorization. The portal checks it against `getContexts` on both code creation and redemption; revoked subscription or removed role fails redemption.
- Portal platform `super_admin` can have `platform_super_admin` as product context; the Music app must explicitly decide what that grants. **Never silently map platform admin to every Music function.**
- The current `app_roles` list has `super_admin`, `admin`, `manager`, `user`, `viewer`; it does **not yet define `staff` or `musician`**. Music staff/performer authorization must be modeled separately before its demo authentication can be removed. Never infer a musician's identity from a username in the demo dataset.
- **Guest QR/table routes remain public** subject to appropriate abuse controls and tenant/location validation; SSO is for employees and performers.
- Login state is not transferred with a browser localStorage object, profile JSON URL parameter, cross-domain cookie, or reusable bearer token.
- The code is *single-use*, audience-bound to Music, PKCE-bound to a browser-initiated transaction, hashed at rest, and expires in one minute. `state` binding MUST be implemented in Music's receiver to prevent login CSRF.
- Client secret rotation, audit records, rate limiting, CSRF policies, session expiration and real deployment tests must be completed before production activation. This handshake is purpose-built, **not advertised as a general OAuth/OIDC-compliant provider**.

## Local tests and manual release gates

```powershell
npm test
npm run check
npm run dev
```

Test cases: anonymous launch denied; CRM falls back to its existing local login; Music falls back while unconfigured; authorized organization only; cross-tenant selection denied; inactive application/subscription denied; tampered state/PKCE rejected at Music; expired/replayed code rejected; invalid client secret denied; revoked membership/role/session rejected at redemption; guest endpoints remain independently accessible.

**Rollout sequence:** deploy portal migration + portal code with Music env unset → implement and test Music backend receiver + Music protected sessions → configure trusted Music URLs/secret in both services → integration test → enable external Music launch. Do not delete the current product login or rely on the Music demo for production access in PR #5.
