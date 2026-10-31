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
- [ ] Password recovery/change and MFA enrollment/step-up remain NOT IMPLEMENTED. Test the implemented own-session inventory/revocation below; it makes no device identity claim.

## Dashboard and navigation

- [ ] Regular user sees only allowed products and tenant contexts; platform admin sees central controls without inheriting product staff access.
- [ ] Metrics reconcile with actual permitted products/workspaces; no financial/uptime/active-user claim is inferred from entitlement counts.
- [ ] /dashboard and /applications are distinct views; searches return real permitted products and useful empty/error states.
- [ ] Desktop sidebar toggles 256px to 72px and content reflows; preference survives navigation/reload. Storage denial does not break layout.
- [ ] Labels/tooltips/focus remain usable in collapsed rail. Mobile drawer works at 950px breakpoint, closes by keyboard/backdrop and returns focus correctly.
- [ ] /admin and new-customer entries are absent for ordinary users; typing their URLs still receives server denial.

## Customer onboarding and invitation acceptance

- [ ] Five steps preserve entered fields and validate name, slug, administrator email, unique products, plan code and future trial end date.
- [ ] Unavailable product, duplicate slug/email, malformed IDs and repeated/concurrent submits fail safely with no unintended duplicates. Verify the durable job/outbox and same-key retry evidence; external Auth/delivery failures still require provider reconciliation.
- [ ] Review step matches server payload. Customer membership stays invited until acceptance; invitation alone grants no product access.
- [ ] Approved synthetic recipient receives the email, exact redirect reaches /accept-invite, token fragment is removed promptly and no token enters logs/screenshots.
- [ ] Recipient sets password and can access only intended tenant/products. Verify the purpose-bound capability, expiry/revocation and accept-one-membership behavior; legacy broad bearer links must fail.
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

## Project portfolio and delivery — current MVP and later integration gates

- [ ] Confirm no existing product card is misrepresented as an internal project. /projects is now the authenticated portfolio.
- [ ] create internal/client project, accountable owner, product links and explicit team assignments; customer visibility must be opt-in.
- [ ] create/depend/complete milestones, assign/update tasks, attach safe HTTPS delivery evidence, compute actual overdue health and archive a project.
- [ ] unrelated tenant/customer cannot list/read/edit/export internal project records or assign itself; product grants do not imply project membership.
- [ ] After M8: verify actual repo/PR/CI/release/deployment facts against the connected provider, stale/disconnected states, deduplicated webhook/poll events, environment binding and rollback evidence.
- [ ] GitHub/Vercel tools used for engineering this change are not application-level integrations. The application App workflow exists; the engineering connector identity does not prove live application acceptance.

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

## Phase 2 implemented acceptance (supersedes earlier unavailable labels)

The Projects MVP now exists at /projects after staging migration installation. The earlier M7 “currently unavailable” section is historical; use these current checks:

- [ ] Platform administrator creates an internal and a customer project; ownership/product links are distinct from entitlements.
- [ ] Manager assigns active accounts to manager/contributor/viewer/client roles and development-team labels; owner must transfer accountability before revocation.
- [ ] Contributor updates assigned task status, cannot edit title/assignee/team or unrelated work. Viewer/client writes fail on API as well as UI.
- [ ] Milestones/dependencies/tasks/priorities/dates save and reload; task/milestone/project invalid transitions fail. Changing a dependency while completing a milestone cannot bypass dependency readiness.
- [ ] Comments/HTTPS evidence and actor activity persist; private evidence linked to a private task does not leak its title through client history.
- [ ] Concurrent same-version changes produce one winner/409; membership/tenant revocation blocks the next request. Explicit account disable racing enrollment cannot deadlock into successful reactivation.
- [ ] Visible task completion/overdue work matches source records; no tasks means “No tasks”, not invented percentages. Customer views count only shared work.
- [ ] Mobile tables scroll within panels without page overflow; desktop sidebar collapse and mobile drawer work, labels/focus remain usable.
- [ ] New onboarding requests are 202 queued and repeat idempotently; inspect outbox/recovery, never assume email was sent. Failed provider/Auth enrollment stays recoverable without membership activation.
- [ ] Reject legacy bearer activation, wrong/missing purpose proof, expiry, replay, revoked capability and existing-account identity mismatch. Accept one invite without activating another pending membership.

Automated isolated PostgreSQL and desktop/mobile workflows cover these core paths; full hosted Auth/provider/SMTP, real-device/accessibility and production UAT remain separate sign-offs.

## Phase 3 engineering, inbox and sessions

- [ ] Approved migrated staging only: verify 002–007 history/backup and real PostgREST/Auth behavior. Confirm no bootstrap/seed/customer emails/deployment occurs during fixture tests.
- [ ] Default disabled GitHub connector explains required setup. App ID/key/secret/token never appear in HTML, JSON, console, logs or screenshots. Invalid key/permission/token fails safely.
- [ ] Platform admin verifies project-specific installation; manager discovers paginated repositories only from that installation. Wrong account/App, suspended or missing permission denies. Product admin, contributor, client and outsider cannot connect/synchronize/disconnect.
- [ ] Connect one or multiple authorized repos; canonical name/default branch/private state match GitHub. Sync categories advance bounded checkpoints and survive reload/restart. Confirm commits/contributors, all PR states, runs/checks, releases and tags against actual sandbox sources after provider setup.
- [ ] Inspect source/observation timestamps, unknown tag/contributor times, stale data, rate-limit deadline and attention. Duplicate polling/webhooks create no duplicate records/events. Retry/webhook/reconnect cannot bypass persisted backoff. Invalid/tampered/conflicting webhook denies.
- [ ] Disconnect during a claimed sync; stale worker cannot publish. Revoke installation/project membership; private records, links, notifications and reports disappear on subsequent reads. Client sharing never grants engineering metadata. Cross-project task/milestone/source IDs deny.
- [ ] Link PR/release using explicit persisted IDs; reload and verify association. Do not infer linkage by similar titles. Compare historical failure/recovery timeline with source state.
- [ ] Vercel displays disabled/unconfigured until exact ownership/source/project mapping is established. No Music hostname is connected by name similarity. No automatic deploy/rollback/secret operation exists.
- [ ] Assignment, milestone completion, PR/release change and build failure/recovery enter personal in-app inbox; repeat dispatch does not duplicate. Preference opt-out suppresses new delivery. Mark read affects only own entry. Test internal dispatcher failure/backoff/attention retry.
- [ ] Run approved finite overdue scan; daily task/user reminders dedupe. Verify overdue task completion/date and assignee/permission changes. Verify overdue milestone daily reminders reach only explicit managers; completion/due-date changes suppress delayed delivery, and demotion hides manager-only entries. External-channel notices remain incomplete.
- [ ] Reconcile report task progress/assignments/overdue/milestone/open PR/requested-review/failure counts; filter project/customer/owner/lifecycle/creation dates. Reject invalid UUID/date/filter, wrong-tenant IDs and disabled sessions. Retained failed observations are not current uptime/build health.
- [ ] Verify desktop collapse, mobile drawer, horizontal delivery/report table scrolling, keyboard labels, source link safety and no page overflow. Full accessibility/real-device/zoom certification remains pending.
- [ ] Register isolated third sandbox product and entitlement; generic context works without code changes, denies revoked/expired/wrong-tenant access, reports unconfigured operational records and clears its cookie/session on portal logout. CRM/Music policies still hold.
- [ ] Own session inventory shows current/other created/expiry timestamps and no hashes/cookies. Wrong-user ID cannot revoke another user, current session is preserved, other product sessions cascade, simultaneous revocations fail closed. Expired/revoked current session denies.
- [ ] Repeat existing login/dashboard/onboarding/purpose-bound invite/subscription/product/admin/audit/logout matrix above. MFA/recovery/legacy invitations/Music live SSO require their separate remaining acceptance.

## Continued readiness and restore acceptance

- [ ] Record hosted target/source binding and resolve HOSTED_SCHEMA_FINDINGS.md. The existing legacy-only candidate is not approved disposable staging.
- [ ] `check:migrations` passes all checksums/dependencies; target inspection reports missing objects/history honestly and always leaves releaseReady false. Never repair history or run bootstrap automatically.
- [ ] GitHub verification compares persisted details as well as identities: contributor count, PR head and tag changes cannot pass as current when stale. Provider key/session values remain server-only.
- [ ] During project mutations and refresh, editable controls remain busy until the complete detail refresh ends. Rapid mobile edits do not silently lose typed comments.
- [ ] In isolated staging only: overdue manager reminders dedupe, opt-out suppresses, completed work does not deliver, contributor demotion and full membership revocation hide prior manager-only notices.
- [ ] Review CI native dump/restore comparison evidence; separately rehearse approved hosted recovery before claiming hosted readiness or an RPO/RTO.
