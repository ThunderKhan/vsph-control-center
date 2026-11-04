# Portal performance and navigation

## Local resources and independent loading

All portal/product styles now import the bundled Inter font from the same origin. The full unmodified upstream font and SIL OFL license are committed; provenance and SHA-256 are in `public/fonts/README.md`. Google Fonts DNS/TLS/CSS/font requests are removed, and CSP no longer allows those origins. Text can paint with a fallback during loading. Only the content-addressed public font receives immutable caching; private HTML and APIs retain `no-store`.

Dashboard navigation capability discovery runs independently of the owner read models and application/workspace loading. A slow HR permission lookup no longer blocks the dashboard's finance/operating requests. Workspace counts also load alongside the application directory rather than delaying its first display. These changes do not cache or bypass authorization: every protected server request still checks current access.

The local Chromium runner defaults to two workers rather than half of an arbitrary workstation's CPU count. The supplied Windows log ran eight workers and timed out on two `page.goto('/projects')` load events while Node and PostgreSQL tests passed. This is not evidence of missing DB migrations. Browser tests now explicitly verify offline third-party independence and owner content while HR capability lookup is held. No timeouts or assertion thresholds were enlarged to hide the failures.

## Verification limits

The end-to-end fixtures use a real disposable PostgreSQL database and simulated provider identities. They prove the rendering/dependency boundary and authorized workflows, not a speed measurement of the user's Windows/network/Supabase connection. The database remains remote even when Express listens on localhost. Server round-trip reductions and request timing should be reviewed separately. No hosted schema, credentials, customer records or email delivery is changed by these frontend improvements.
