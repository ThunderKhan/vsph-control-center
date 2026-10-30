# Manual QA and staging UAT checklist

Use only a confirmed isolated staging Supabase project and synthetic identities. Never send test invitations to real customers. Record tester, date, main SHA, environment, expected result, actual result and evidence for each step. Untested cases remain unchecked. Passing a source assertion is not a manual pass.

Prerequisites: reconcile schema/history; install reviewed migrations; exact PUBLIC_ORIGIN and /accept-invite Auth redirect allowlist; approved SMTP test recipient; tenant A/B and VSPH-internal fixtures; product subscriptions/grants; explicit platform and scoped roles; verified proxy configuration. Music SSO additionally requires proven Git/domain ownership and backend data isolation. Several prerequisites are currently blocked.

## Portal login, identity and sessions

- [ ] Anonymous /dashboard, /applications, /admin, /admin/onboarding and /apps/music/home redirect to /login; API equivalents return JSON 401, never protected HTML/data.
- [ ] Valid credentials for active user open the dashboard; incorrect password/email gives safe failure without exception or token details.
- [ ] Disabled user cannot login or reuse a previously issued cookie. Pending membership confers no product access.
- [ ] Active portal cookie on / or /login redirects before the sign-in form appears; stale/deleted/expired cookie does not loop.
- [ ] Cookie is HttpOnly, SameSite=Lax and Secure in production; no secret key/access token appears in JS, localStorage, console, URL or logs.
- [ ] Concurrent failed attempts reach 429 and Retry-After. Spoofed X-Forwarded-For cannot change client identity under the actual ingress policy. Record shared-network effects. Multi-instance enforcement remains unimplemented.
- [ ] Malformed/oversized JSON produces 400/413; unexpected failure has a request ID and generic 500.
- [ ] Password recovery/change, MFA enrollment/step-up and device/session inventory are marked NOT IMPLEMENTED until M3 delivers and tests them.

## Dashboard and navigation

- [ ] Regular user sees only allowed products and tenant contexts; platform admin sees central controls without inheriting product staff access.
- [ ] Metrics reconcile with actual permitted products/workspaces; no financial/uptime/active-user claim is inferred from entitlement counts.
- [ ] /dashboard and /applications are distinct views; searches return real permitted products and useful empty/error states.
- [ ] Desktop sidebar toggles 256px to 72px and content reflows; preference survives navigation/reload. Storage denial does not break layout.
- [ ] Labels/tooltips/focus remain usable in collapsed rail. Mobile drawer works at 950px breakpoint, closes by keyboard/backdrop and returns focus correctly.
- [ ] /admin and new-customer entries are absent for ordinary users; typing their URLs still receives server denial.

## Customer onboarding and invitation acceptance

- [ ] Five steps preserve entered fields and validate name, slug, administrator email, unique products, plan code and future trial end date.
- [ ] Unavailable product, duplicate slug/email, malformed IDs and repeated/concurrent submits fail safely with no unintended duplicates. Durable idempotency/reconciliation is still incomplete; do not approve this gate on mocked success.
- [ ] Review step matches server payload. Customer membership stays invited until acceptance; invitation alone grants no product access.
- [ ] Approved synthetic recipient receives the email, exact redirect reaches /accept-invite, token fragment is removed promptly and no token enters logs/screenshots.
- [ ] Recipient sets password and can access only intended tenant/products. Verify purpose/expiry/revocation and accept-one-invite behavior after durable invitation state is implemented; current purpose model is insufficient for release.
- [ ] Wrong account/email, expired/replayed/revoked link, missing token, failed SMTP, duplicate resend and Auth-success/DB-failure are exercised with reconciliation evidence. Resend/revoke/repair UI remains M2/M3 work.
- [ ] Legacy POST /api/admin-management/users and /clients return 410, including requests for super_admin elevation. Admin UI collects no temporary password/platform role.

## Roles, status and account revocation

- [ ] Ordinary profile, invited member, tenant owner/admin, staff, musician, viewer and platform super_admin are tested separately. Organization/product roles never become platform authority.
- [ ] Platform admin without product membership/role cannot launch customer products. Explicitly assigned admin gets only the assigned tenant/product role.
- [ ] Product role cannot be used in a different app; staff/musician assignments to CRM are rejected.
- [ ] CRM and Music write allowlists match docs/operations/PRODUCT_AUTHORIZATION.md. Viewer/musician/unknown roles cannot create generic records.
- [ ] Active membership + role + enabled grant + active tenant + effective subscription are all required. Remove each individually; existing product sessions lose access on next request.
- [ ] Apply/verify atomic identity function in staging first. Disable a synthetic ordinary user: profile becomes disabled, all portal/app sessions and outstanding Music codes disappear, and one audit event records the change.
- [ ] Concurrent identical disable retries produce one state transition/event; audit outage rolls everything back; re-enable does not restore old cookies.
- [ ] Self-disable, another platform-admin status change and regular-actor RPC execution are denied. Governed admin recovery/elevation remains unavailable.

## Subscriptions and customer operations

- [ ] Active/trial access respects starts_at and ends_at; future start, expiry, past_due/cancelled/expired, suspended/closed organization and revoked grant deny access.
- [ ] Re-enabling a grant never bypasses individual membership/role. One tenant's change cannot affect another's rows.
- [ ] Subscription flags are presented as entitlements; no invoice/payment/revenue assertions appear.
- [ ] Renewal notices, history, customer detail, customer-admin self-service, bulk confirmations, exports and notification retry gates remain unimplemented; record these as blocked/unavailable, not passes.

## Project portfolio and delivery — currently unavailable

- [ ] Confirm no existing product card is misrepresented as an internal project. /projects currently returns 404.
- [ ] After M7: create internal/client project, accountable owner, product links and explicit team assignments; customer visibility must be opt-in.
- [ ] After M7: create/depend/complete milestones, assign/update tasks, attach safe HTTPS delivery evidence, compute actual overdue health and archive a project.
- [ ] After M7: unrelated tenant/customer cannot list/read/edit/export internal project records or assign itself; product grants do not imply project membership.
- [ ] After M8: verify actual repo/PR/CI/release/deployment facts against the connected provider, stale/disconnected states, deduplicated webhook/poll events, environment binding and rollback evidence.
- [ ] GitHub/Vercel tools used for engineering this change are not application-level integrations. No connected-project feature is claimed today.

## Music and external integrations

- [ ] Independently establish Vercel team/project/domain/Git repo/source SHA before merging/enabling the receiver. Current target project lookup returns 404 in connected team.
- [ ] Review Music PR #1 against its latest main and the chosen integration threat model. Keep SSO variables unset until staged ownership/session/backend permissions are verified.
- [ ] Guest QR routes remain public as intended. Staff/musician routes require server verification, tenant role and explicit performer mapping.
- [ ] Test cross-origin start/callback, fixed HTTPS targets, state/PKCE mismatch, replay, expiry, wrong secret/tenant, revoked grant/session and logout.
- [ ] Public Music demo link is labeled separately and never counted as SSO proof. Browser-local request queues are never treated as secure durable customer data.
- [ ] Persistent venue/tenant backend, abuse controls, server writes and mobile flow must pass before production Music operations are accepted.

## Audits, notifications, operations and recovery

- [ ] Atomic identity event contains actor, target, before/after status and counts without credentials. Authorized audit list is isolated; regular users cannot enumerate it.
- [ ] Other admin mutations still need atomic audit semantics. Immutable retention/search/export and deduplicated notifications are not yet complete.
- [ ] Inspect CSP, no-store, HSTS on HTTPS production, no-sniff, frame denial and referrer policy. Scripts, fonts and pre-paint sidebar still work without unsafe inline scripts.
- [ ] Logs/errors contain request IDs without credentials; inspect onboarding-specific logs separately. Trace/alert pipelines and incident ownership remain unimplemented.
- [ ] Perform real staging backup/restore, populated migration upgrade, incident exercise and bounded load measurement before M11/M12 acceptance. No RPO/RTO/SLA claim is approved.

## Responsive, accessibility and logout

- [ ] Desktop 1440px, tablet 768px, mobile 390px and narrow 320px: login, dashboard, admin, onboarding, forms and tables have no lost controls/horizontal clipping.
- [ ] Test keyboard-only navigation, visible focus, labels, error announcements, dialogs/drawer focus behavior, reduced motion and touch targets.
- [ ] Verify 200%/400% zoom and automated axe on authenticated workflows; WCAG 2.2 AA has not been established by current smoke tests.
- [ ] App logout removes only selected app session. Portal logout deletes portal session and cascades all associated app sessions; old cookies/Back/reload cannot recover data.
- [ ] Music introspection observes revoked portal session; independent Music logout is tested only once verified receiver is deployed.

Acceptance sign-off requires evidence for every applicable check and an explicit residual-risk decision. Unimplemented functionality remains a release blocker, not an optional pass.
