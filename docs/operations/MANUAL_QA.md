## Recorded owner landing

- Sign in as owner and open Dashboard. Verify issued/collected/outstanding/past-due amounts and six calendar months against Finance/API persisted data, including invoice/receipt/reversal/void changes after refresh. Counts describe issued invoices and their customer/project associations.
- Open the illustrative preview explicitly, check its notice, then return to fresh recorded data. Ordinary/customer users and a forged preview query must not reveal recorded owner data or grant product access.
- Test schema-not-ready, network failure, twelve-second timeout, retry, invalid numeric money and revoked/expired permissions using disposable fixtures. Old balances clear on errors; zero is shown only for a valid empty ledger. Refresh clicks coalesce.
- Validate exact large amounts, keyboard navigation, desktop collapse/mobile drawer, no horizontal overflow and reload persistence. Native/backend fixtures prove authorization; mocked transport proves failure presentation only. No hosted/provider verification is implied.

## Exact owner finance acceptance

After reviewed migration installation on a separately approved target, open Finance as the owner; record an invoice and partial receipt, reload and reconcile every summary/group/month/row with persisted records. Money in `/api/finance` must be decimal-string paise; counts/versions stay numbers. A concurrent receipt must appear consistently across all sections of the next report. Customer/HR/product roles and stale/revoked/expired sessions cannot read owner finance. An absent read RPC must show schema-not-ready rather than use the historical numeric response. Use disposable fixtures for maximum amounts and failure/concurrency tests; do not create demonstration financial records on a customer database. Validate desktop/mobile layout, keyboard forms, confirmation, reversal/void conflicts and no localStorage credentials. Full journal pagination/export/client dashboards remain separate.

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
- [ ] Wrong account/email, expired/replayed/revoked link, missing token, failed SMTP, duplicate resend and Auth-success/DB-failure are exercised with reconciliation evidence. Use generation-fenced reissue/cancellation and reconciled recovery; delegated customer-admin governance remains incomplete.
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
- [ ] Customer detail, lifecycle/entitlement confirmation and invitation recovery now exist. Renewal notices, broader history/export, customer-admin self-service and bulk workflows remain incomplete; record those as unavailable, not passes.

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

## Phase 4 customer, registry and lifecycle acceptance

All checks below require installed/verified target migrations and approved synthetic accounts. They remain unchecked for hosted acceptance even where isolated CI passes.

- [ ] Sign in as a platform administrator; reach Customers from Administration → Users, and Product registry from the application catalog. Follow an organization/product direct link and reload it.
- [ ] Anonymous, expired/revoked portal sessions, ordinary/invited users, organization owners/admins and product super admins cannot enter platform customer/product administration. A downgraded platform actor is denied by the database despite stale UI.
- [ ] Page product/customer directories and open IDs beyond page one. Directory reads remain bounded. A detail's bounded subcollections are not represented as full exports.
- [ ] Invite an existing active identity to exactly one organization with explicit organization role and optional product roles. Pending membership confers no access. Existing active/suspended membership cannot be silently overwritten by invitation creation.
- [ ] Invite a new synthetic identity only through the approved provider. Profile stays disabled until purpose-bound acceptance; unknown Auth/password/delivery results enter reconciliation. No admin-assigned password or platform elevation exists.
- [ ] Same actor/key/payload returns one job; changed payload or duplicate live org/email conflicts. Concurrent first requests do not duplicate jobs/users/memberships. Malformed IDs, roles, unknown fields and Music-only roles on CRM fail.
- [ ] Expired/replayed/wrong-identity capabilities fail. Reissue rotates generation/token/lease and invalidates the old URL. Stale cancellation/reissue conflicts; it must not revoke a newer reviewed generation.
- [ ] Ordinary cancellation of staged new enrollment can be reissued. Explicit account disable remains blocked, including historical ambiguous revoked/disabled rows. Ambiguous in-flight acceptance requires reconciled recovery, not blind resend.
- [ ] Accepted membership role/status and explicit product-role changes save/audit atomically, revoke affected product sessions/codes and persist after reload. Invited status cannot be changed to active by administration. Last active owner removal denies.
- [ ] Organization suspension displays impact and requires confirmation; it revokes sessions/codes/pending delivery. A login or worker bind racing suspension cannot create usable access or deadlock the completed workflow. Reactivation restores no old sessions/capabilities. Closed lifecycle is terminal here.
- [ ] Save grant and subscription terms together; reject invalid dates/plan/status, trial without future end, absent confirmation and stale version. Future/past terms still enforce actual access. No payment/invoice claim appears.
- [ ] Edit a non-first customer/product in the legacy subscription/access form, save, adjust and save again. Selections must stay on that customer/product and refreshed version; other tenants remain unchanged.
- [ ] Register a portal-only product and reload. Matching create retry dedupes; conflicting registration/version fails. Owner UUID must identify an active profile. Code/path is immutable/derived; retirement cannot be reversed by editing.
- [ ] Unknown secret/config/module/table/provider URL fields are rejected; no key/token/ciphertext appears in metadata, errors, logs, HTML, localStorage or screenshots. Documentation URL rejects unsafe schemes/credentials.
- [ ] Disable/maintenance/retire blocks product launches and revokes old product sessions. Unlisted affects catalog discovery while direct routes still require full tenant/role/term authorization. Platform admin does not inherit product roles.
- [ ] Readiness distinguishes server configuration, scoped local adapter reachability, failure and missing integration. Explicit check persists timestamp/scope/version; external verified stays false. Music demo availability does not verify SSO.
- [ ] Exercise audit outage and stale/concurrent forms in isolated fixtures; no partial metadata/grant/subscription/membership write should survive a failed transaction. Review native duplicate-migration rollback/repair and restored trigger/index evidence separately from hosted recovery.
- [ ] Tab through registry fields, enter data by keyboard, confirm focus/error announcements, use all selects/buttons at mobile width, and try long unbroken product/customer names. Preserve existing Projects/sidebar/drawer/login/onboarding/logout workflows. Full WCAG/zoom/real-device sign-off remains open.
- [ ] /api/health reports connectivity scope and releaseReady=false; it cannot certify migration/Auth/provider/worker/enterprise readiness. Test configured dependency failures without logging secrets. Operational monitoring/load and live MFA remain separate release gates.

## Customer-admin workspace and report export — 3 November 2026

The three new self-service migrations are unapplied hosted. Use isolated fixtures for automated acceptance; any manual customer-data exercise requires an appropriate prepared target. Do not use production email recipients or bootstrap/seed the existing database.

- [ ] Existing login, account identity, collapsible desktop sidebar, mobile drawer and logout still work. My organizations appears in the main navigation. Revoked/expired portal sessions fail on the new API as elsewhere.
- [ ] An active customer owner/admin sees only their authorized active organizations, with real membership counts and assigned subscription/access terms. An ordinary member or unassigned platform admin gets an empty administrative directory and cannot read an organization directly.
- [ ] Rename the organization, reload and confirm persistence. Slug, subscription, lifecycle, platform role and unknown fields cannot be changed through this API. Two stale name edits conflict rather than overwriting silently.
- [ ] An owner can manage admins and ordinary members; an admin can manage ordinary members only. Self, owner and platform-account changes deny. Pending invitations cannot be activated manually. A disabled account cannot be reactivated through its membership.
- [ ] Assign a product role only with an explicit product-admin identity and effective grant/subscription. Missing authority, future/expired terms, unavailable product and super_admin assignment deny. Suspension or role change invalidates tenant product sessions/codes; other organizations and project assignments remain unchanged.
- [ ] Queue an invitation to an approved synthetic recipient with explicit organization/product roles. Retries do not duplicate the job. Status remains queued until a separately configured worker confirms delivery; a queued screen is not proof of email delivery.
- [ ] An admin cannot invite another admin; an owner may. Each issuer sees/manages their own invitations. Another organization or issuer cannot inspect/change them through the delegated API.
- [ ] Renew an expired invitation and cancel a current one. Previous capability/generation fails. Accepted/accepting/ambiguous/blocked identities require platform recovery. Revoking the inviter or their product authority blocks acceptance of an already sent delegated link.
- [ ] In isolated failure tests, delivery timeout preserves a retryable encrypted capability and audit failure rolls back the mutation. Losing issuer permission between reserve/finish leaves membership unactivated and requires recovery.
- [ ] Projects, milestones/tasks/team/history and project notifications still work independently of organization/product administration. Customer organization administration does not grant private project/GitHub access.
- [ ] Apply report filters, download the summary CSV and compare its project/counts to the displayed persisted report. Confirm the first-100 bound and unconfigured deployment status. No revenue/uptime/productivity figures are invented.
- [ ] A client-only, unrelated or revoked project member cannot export internal report data; expired/anonymous sessions deny. Spreadsheet-dangerous project/owner names remain text. Store downloaded files privately; revoked permissions do not erase existing copies.
- [ ] At mobile width and keyboard-only navigation, selects/inputs/buttons have usable names/focus, no page-width overflow occurs, conflicts/errors are announced and saved changes survive reload. Full accessibility certification remains outstanding.

## MFA-aware login and owner transfer — 3 November 2026

Use disposable fixtures unless a real identity/target has been approved. No hosted Auth enrollment/settings or live database changes were performed for this acceptance.

- [ ] A password-only account still signs in without fabricated AAL2. An enrolled TOTP account gets no portal/product session for password alone, wrong code, unknown factor ID, stale assurance or provider failure. A valid current code reaches the same identity/AAL2 before session creation.
- [ ] Multiple verified authenticators require selection from the server-owned list. Unsupported enrolled methods deny password fallback. Factor metadata appears only after a valid password, one-time codes clear after attempts and no provider token/password appears in localStorage, URLs, responses or logs.
- [ ] Existing sessions are not described as retrospectively MFA-certified. Do not disable MFA or use fixture credentials on a live account to bypass the unsupported enrollment/recovery workflow.
- [ ] In My organizations, the sole active owner selects an accepted active administrator and reviews names/impact. An admin, ordinary member, invited/suspended/disabled account, unrelated tenant or unassigned platform admin cannot transfer ownership. Multiple active owners require review.
- [ ] Wrong password/TOTP leaves ownership unchanged and does not redirect an otherwise valid portal session to login. The owner must explicitly acknowledge becoming an administrator before transfer.
- [ ] Fresh verification produces only a short-lived session-bound proof. Replay, changed target/organization/session/versions, expired or superseded proof, logout/revocation and permission changes deny. Concurrent requests create exactly one owner change/audit.
- [ ] Successful transfer survives reload: successor is owner, former owner is admin, tenant product sessions/codes are invalidated, and product roles/subscriptions/project assignments remain unchanged. The successor can sign in normally without inheriting product access.
- [ ] An isolated audit outage rolls back ownership, proof consumption and session invalidation together. A lost HTTP response requires refresh/history review rather than automatic reversal or stale retry.
- [ ] Test both desktop/mobile layouts and keyboard focus. The password/code fields clear after step-up, the old owner no longer sees transfer controls after success, and other customer/project/registry/onboarding/sidebar/logout flows remain functional.

## Cross-project work search

- From the desktop sidebar/mobile drawer, open Search work. Search a persisted project name/key and task/milestone titles; use keyboard labels, submit, result focus and a project link. Confirm no mobile overflow.
- Create more than 25 matches in an isolated fixture only. Traverse next/first pages with no duplicates. Change a filter and confirm stale records/paging disappear until a new search.
- Test exact type/status/project/customer/task-assignee/due date filters, literal `%_`, invalid dates/UUIDs and short/oversized searches. Confirm empty versus unavailable states are clear.
- Revoke a membership between pages; the next request must hide that project's work. Test a client with shared/private tasks and milestones, inactive customer membership and hidden project. Organization/product administration alone must not expose project work.
- Simulate dependency failure after results were visible; stale results must clear, retry must recover. Reload has no cached result records. Switch to an unrelated user and confirm no prior user's work appears.
- Expired/revoked sessions and anonymous HTML/API access deny as before. Search must not mutate tasks, permissions or provider records.

## Reconciled employee and finance workflows

- As owner, create an internal employee roster record, activate it and grant HR only to a matching existing active ordinary portal identity. Confirm no account, email, customer/product role or project assignment is implicitly created.
- As HR, create/update ordinary employees; deny owner/HR-target edits and HR grants. Test stale and oversized versions. Owner revocation or identity disable must block later HR calls, including pending requests after a roster lock wait. No partial audit/mutation should survive failure.
- Owner-only finance: create a same-customer project invoice, record a real synthetic receipt, prevent overpayment, explicitly reverse with reason, then void only after receipts are reversed. Reload to verify durable totals and outsider/HR/customer-admin denial.
- Keep executive demo labels visible; finance cash collection is not recognized revenue or subscription billing. Do not enter real payments in fixture tests. Follow FINANCE_LEDGER.md for manual journal bounds and unimplemented provider acceptance.

## Inbox failure recovery

- In disposable fixtures, fail the first `/api/notifications` request. An error must appear; unread notification preferences must remain disabled. Refresh inbox must be wired and usable without a page reload.
- Restore the endpoint and refresh. Preferences load, reports generate and inbox content returns. An outage during a later refresh must clear stale inbox records and remain retryable.
- A stalled request must end after the 12-second deadline with a clear retry message. Multiple refresh clicks must share one initialization, and ordinary successful refresh must preserve unsaved preference edits. Server authorization still applies to every request.

## Recovery concurrency and drafts

- Mark a notice read while its response is delayed, then refresh. Release the older unread response last: the current row must remain Read with no duplicate. A late success after a newer failure must not repopulate stale records.
- Fail the first project report after preferences loaded. Change a preference without saving, recover the report using Refresh and confirm that draft is preserved. No preferences may be saved before their initial read succeeds.

## Existing employee account consent

- Create a roster for an existing ordinary account, request its link as owner/current HR, then sign in as the intended employee and open My employment. Verify only that employee's minimal records/requests appear. No real email or account is created.
- Accept with wrong password, missing/wrong TOTP and then valid credentials. Failed attempts must create no link; a successful link survives reload and grants no HR/customer/product/project role. Owner must separately grant HR to an Active linked employee.
- Test cancellation, expiry, renewal/stale versions, changed roster, another identity, lost issuer authority, disabled account and revoked/expired sessions. Concurrent acceptance must have one effect/audit. Audit failure rolls back acceptance.
- Revoke the link as owner: HR access disappears, ordinary portal/customer/product/project assignments stay independently governed. Inactivation/identity disable/email change must invalidate links; reactivation restores none. Check mobile, keyboard/form labels and no credentials in URL/localStorage.
