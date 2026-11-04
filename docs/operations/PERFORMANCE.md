# Portal performance and navigation

## Local resources and independent loading

All portal/product styles now import the bundled Inter font from the same origin. The full unmodified upstream font and SIL OFL license are committed; provenance and SHA-256 are in `public/fonts/README.md`. Google Fonts DNS/TLS/CSS/font requests are removed, and CSP no longer allows those origins. Text can paint with a fallback during loading. Only the content-addressed public font receives immutable caching; private HTML and APIs retain `no-store`.

Dashboard navigation capability discovery runs independently of the owner read models and application/workspace loading. A slow HR permission lookup no longer blocks the dashboard's finance/operating requests. Workspace counts also load alongside the application directory rather than delaying its first display. These changes do not cache or bypass authorization: every protected server request still checks current access.

The local Chromium runner defaults to two workers rather than half of an arbitrary workstation's CPU count. The supplied Windows log ran eight workers and timed out on two `page.goto('/projects')` load events while Node and PostgreSQL tests passed. This is not evidence of missing DB migrations. Browser tests now explicitly verify offline third-party independence and owner content while HR capability lookup is held. No timeouts or assertion thresholds were enlarged to hide the failures.

## Verification limits

The end-to-end fixtures use a real disposable PostgreSQL database and simulated provider identities. They prove the rendering/dependency boundary and authorized workflows, not a speed measurement of the user's Windows/network/Supabase connection. The database remains remote even when Express listens on localhost. Server round-trip reductions and request timing should be reviewed separately. No hosted schema, credentials, customer records or email delivery is changed by these frontend improvements.

## Current-session checks in one round trip

Portal authentication now selects the session plus its explicitly projected current profile through the existing `portal_sessions.user_id` foreign key, using PostgREST's many-to-one embedded join. This replaces two sequential server-to-Supabase HTTP reads with one statement. Missing/expired/revoked sessions, inactive profiles, a mismatched profile and downgraded owner roles still deny. No authorization result is cached across requests. SQL mutation guards remain unchanged.

Authenticated and optional-login responses expose `Server-Timing: auth;dur=...`, with the measured middleware duration only; tokens, IDs, emails and SQL/provider details are absent. This helps distinguish remote database delay from browser resource loading. Native HTTP tests count exactly one SQL query and verify role changes, disable, expiry and deletion against real fixture rows; mock-provider failure tests fail closed. This does not measure the user's actual network or prove a live provider login.

Development watching is restricted to runtime code, environment configuration and the dashboard prepaint template. Test reports, coverage, docs and migrations no longer cause incidental development-server restarts. Neither caching policy nor production runtime authentication is weakened. No database migration is required for this optimization: the existing hosted profile foreign key was verified read-only. Reference: https://supabase.com/docs/guides/database/joins-and-nesting.

## Owner operating snapshot

Migration `20261104153559_owner_dashboard_snapshot.sql` adds a read-only, stable, service-role-only function. It checks the current active platform owner and live session before producing the six bounded operating sections. Missing table/column failures remain section-specific; other failures are surfaced. Finance remains an independent request. No business rows are changed.

The operating read model falls from twenty PostgREST requests to one RPC. Including authentication and the existing post-read owner check, its endpoint falls from 23 database requests to three. These are query-count assertions, not a measured page-speed claim. Native tests cover current roles, foreign/revoked sessions, denied browser database roles, field projection, unavailable sections and a concurrent update while the snapshot is blocked. There is no shared authorization cache.

Install the reviewed migration before running the new endpoint in its target environment. A code rollback can restore the previous implementation while leaving this unused read-only function installed. Do not reset, seed or rewrite migration history. Hosted installation is pending until recorded explicitly in the implementation report.
