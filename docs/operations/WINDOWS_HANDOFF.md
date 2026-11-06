# Temporary employee credentials — 6 November 2026

The additive migration is installed; do not rerun bootstrap, seed or reset. Pull main, run `npm ci` and restart `npm run dev` at localhost:3000. Owner/HR: **People → Employees → Account link → Create temporary credentials**. Deliver the once-shown details privately. Employee: normal login, mandatory personal password/consent, then sign in again. Existing accounts retain their credentials; roster activation and owner-only HR grants remain separate. No automatic email or live Auth acceptance is claimed. See [installed evidence and full acceptance](EMPLOYEE_TEMPORARY_CREDENTIALS_INSTALL_20261106.md).

# Employee login enrollment — 6 November 2026

The new employee-enrollment migration is installed in the configured database; do not run bootstrap, seed or reset. Pull main, install dependencies and restart at localhost:3000. Use **People → Employees → account link → Create login invitation**, or the onboarding completion's **Set up employee login**. Privately hand the once-shown link to the named employee to choose a password. No email/SMTP or fixture server is required. Existing accounts use consent linking; roster activation and owner-only HR grants remain separate. See [installed evidence and acceptance](EMPLOYEE_ENROLLMENT_INSTALL_20261106.md). Live Auth acceptance from this session is not claimed.

# Current HRMS handoff — 4 November 2026

The configured database has the reviewed profile/HRMS migrations installed. Do not rerun the legacy installer or seed. Pull `main`, install dependencies and restart the portal using the commands below. See [installation evidence](HRMS_INSTALL_20261104.md) and the [owner/HR/employee walkthrough](HRMS_WORKSPACES.md). Older installation cutoffs in this historical guide are superseded by that evidence. Live Auth/MFA and hosted restore are still separate acceptance gates.

# Journal and canonical Windows source handoff — 4 November 2026

Journal code merged in [#63](https://github.com/ThunderKhan/vsph-control-center/pull/63) as `42c0448811a2324bd28aab085d5aa2aa82d055a6`, after 149 Node / 39 native PostgreSQL / 52 active Chromium tests and all gates passed. The additional LF policy/helper passed all four CI jobs on `ba41492ea71820d1a590c4402058c66516d9f465` in [#64](https://github.com/ThunderKhan/vsph-control-center/pull/64): 150 Node / 39 native PostgreSQL / 52 active Chromium, two intentional skips and all existing gates. Its final documentation revision is checked again before merge. Commands are checked on Linux CI with simulated Windows Git line endings; native Windows execution is not claimed.

```powershell
cd D:\Projects\vsph-control-center
git status --short
git switch main
git pull --ff-only origin main
npm ci
npm run migrations:eol -- --write
npm test
npm run check
npm run lint
npm run format:check
npm run check:migrations
npm run test:coverage
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

The normalization command only repairs LF bytes matching the existing reviewed hashes. It refuses actual SQL edits and touches no database. Read [MIGRATION_SOURCE_EOL.md](MIGRATION_SOURCE_EOL.md) before interpreting a checksum failure. Do not regenerate hashes or discard personal work to bypass a refusal. The six moderate development findings are unchanged; no audit fix --force. There is no typecheck/build script. Disposable helpers use empty loopback databases and ordinary OS privileges, without Docker/AWS/hosted URLs. Normal runtime still needs its private Supabase configuration and reviewed target schema.

After approved migration installation: Finance → Search full journal → search an old reference/customer/project → invoice/receipt status and inclusive issue/received dates → Next/Previous → reload. Verify records beyond 50, historical voids/reversals and suspended-customer history, exact amounts, invalid/expired permissions, failed-page Retry, first-page filter reset, keyboard and mobile table scrolling. The journal is read-only; mutation pickers remain latest-50 and finance CSV/customer billing are separate work. The new `20261104053000_finance_journal.sql` is unapplied hosted and adds ordinary indexes that can block writers. Six identities are missing by the last recorded 19-entry ledger; hosting is deferred. Do not reset/seed/bootstrap/push the potentially live target. See [journal contract](FINANCE_JOURNAL.md), [partial history](PARTIAL_MIGRATION_HISTORY.md) and [full QA](MANUAL_QA.md).

---

# Latest owner overview handoff — 4 November 2026

Code baseline `9638eeb5b66e5e55d42fe00cfdb7849b47b25aad` (#61) passes 148 Node, 38 native PostgreSQL and 48 active Chromium tests, plus existing quality/security/restore/helper gates. [Current merges, M0–M12 status and five pending migrations](../roadmap/CONTINUATION_HANDOFF_20261104.md) supersede older cutoffs below. This increment adds no migration. Hosting remains deferred; existing report/ledger migrations are required on the normal runtime target. These commands are verified on Linux CI; this increment was not run on native Windows.

```powershell
cd D:\Projects\vsph-control-center
git status --short
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run check
npm run lint
npm run format:check
npm run check:migrations
npm run test:coverage
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

Use an ordinary OS account for the disposable native helpers. They need no Docker/AWS/hosted URL and never install hosted migrations. Preserve six moderate dev findings; no audit fix --force. No typecheck/build script exists. Existing private Supabase environment, PUBLIC_ORIGIN=http://localhost:3000 and PORT=3000 are required for normal runtime. Do not run reset/seeds/bootstrap against customer data.

For new acceptance on an approved prepared target: sign in as owner, open Dashboard, reconcile four balances and six months with Finance, record an authorized invoice/receipt and refresh/reload to verify persistence. Open the illustrative preview explicitly and return to recorded data. As an ordinary/customer user, confirm your original scoped workspace and denied `/api/finance/overview`. Use disposable fixtures for unknown/missing schema, revoked/expired permissions, numeric/invalid DTO, large exact money and twelve-second timeout/retry cases; prior facts must clear when refresh fails. Validate keyboard navigation, desktop sidebar collapse, mobile drawer and overflow. Then run the full [manual checklist](MANUAL_QA.md) for login, onboarding, invitations, roles/subscriptions, employee consent/HR, Projects/team/milestones/tasks/history, GitHub/private data, Music gating, auditing and logout.

A target missing the finance RPC shows an upgrade message rather than sample balances. Use `npm run test:e2e:db` for immediate isolated acceptance without changing the hosted database. Read [OWNER_OVERVIEW.md](OWNER_OVERVIEW.md) for data/snapshot/authorization limits. Hosting and real provider/identity acceptance remain separate gates.

---

# Current development handoff — employee consent and finance

Code baseline `8704d6b051117dd7bbe2967dcf382751b1ea94fb` includes merged #58/#59. [Current merges, M0–M12 gaps, test evidence and migration boundary](../roadmap/CONTINUATION_HANDOFF_20261103.md) supersede the historical cutoffs below. Latest code PR passed 148 Node, 38 native PostgreSQL and 44 active Chromium cases (two intentional skips). Commands below are actual package scripts tested on Linux CI; this increment has not been executed on native Windows. Use an ordinary Windows account. No local Docker/AWS/Supabase CLI is required by the disposable helpers.

```powershell
cd D:\Projects\vsph-control-center
git status --short
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run check
npm run lint
npm run format:check
npm run check:migrations
npm run test:coverage
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

Keep the six moderate development dependency findings unchanged; no forced audit fix. No typecheck/build script exists. Test helpers create only empty loopback `vsph_test`; never use a hosted URL or run seeds/reset/bootstrap. Normal runtime still needs private Supabase configuration, PUBLIC_ORIGIN=http://localhost:3000 and PORT=3000, plus approved schema installation. By the last recorded 19-entry ledger, search, HR lock repair, employee consent, finance ledger and exact finance report lack installed identities. This continuation installs none of them. Hosting remains deferred; see PARTIAL_MIGRATION_HISTORY.md before any separately approved target write.

For safe immediate acceptance, run `npm run test:e2e:db`: it creates/disposes its own native fixture database, tests existing login/onboarding/products/sidebar/admin/organizations/Projects and the new employee/finance workflows, with explicit fake Auth and no real emails. It does not install migrations on the normal runtime target.

After reviewed target installation, validate the new flow with approved identities:

1. Owner/current HR opens Employees, creates/reviews an ordinary employee roster entry matching an existing active portal account, then opens Account link and explicitly requests consent. This does not send email or create an Auth user.
2. That employee signs in normally, opens My employment, reviews only their own request, confirms with fresh password and enrolled TOTP where required, accepts, reloads and sees only minimal personal employment details. It grants no customer/product/project/HR access.
3. Owner explicitly sets the roster to active if appropriate, then separately grants HR only if needed; consent alone never activates employment. Revoke the employee link and verify HR is removed while independently assigned customer/product/project access and ordinary portal login remain. Renew/cancel/expired/stale/disabled/revoked/changed-issuer cases must deny safely. Use fixtures for races and audit/provider failures.
4. Owner opens Finance, records a real authorized invoice and partial receipt, reloads and reconciles exact amounts, monthly/client/project totals and rows. API monetary values are decimal strings in paise. Reversal/void require reasons and current state. Ordinary/client/HR users and stale sessions deny. Use fixtures for maximum-value/concurrent cases; never enter demo financial records on a customer database.
5. Run the full [manual checklist](MANUAL_QA.md), including Projects create/member/milestone/task/comment/deliverable/history persistence, organizational/product boundaries, GitHub disconnection/privacy, Music verification gating, audit/session/logout, keyboard and mobile drawer/sidebar behavior.

---

## Reconciled development handoff — 3 November 2026

Source acceptance main `a4f80ae1e458740171b266834a8a5de81b661760` includes search, HR lock repair, inbox recovery/response ordering and partial-ledger diagnostics alongside the other chat's employee/finance modules. [Exact merges, tests, scope and M0–M12 gaps](../roadmap/READ_AUDIT_CHAT_RECONCILIATION_20261103.md) supersede historical cutoffs below. Read-only Supabase metadata now records 19 installed entries through internal employees. Only search, HR lock repair and finance lack ledger entries (three pending). Marker/catalog/Auth equivalence remains unverified; no hosted writes occurred. Hosting is deferred.

```powershell
cd D:\Projects\vsph-control-center
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run check
npm run lint
npm run format:check
npm run check:migrations
npm run test:coverage
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

These are actual package scripts and CI commands. The disposable helpers create loopback `vsph_test` databases and never require a hosted database URL. Never set TEST_DATABASE_URL to Supabase/customer data; do not run seeds/reset/bootstrap. Existing six moderate dev findings are unchanged; do not use audit fix --force. No typecheck or build script exists for this Express/vanilla JS repository. CI verified Linux commands; this latest increment was not executed on the user's Windows machine. If native tools are needed, retain the previously installed PostgreSQL bin directory in PATH; do not replace credentials.

Manual acceptance: sign in → desktop sidebar/mobile drawer → Search work → find persisted project/task/milestone titles → filter/page → open a source project and reload. Verify owner/HR employee onboarding/edit/revoke and owner-only finance invoice/receipt/reversal; confirm the executive dashboard's sample-data notice remains explicit. Simulate initial/later inbox failures and recover with Refresh. Use [the comprehensive regression checklist](MANUAL_QA.md) for tenant/access/login/onboarding/subscription/Music/audit/security/logout and responsive checks. Normal dev runtime still needs reviewed migrations on its configured target; disposable acceptance does not install hosted migrations.

# Windows PowerShell — continued implementation

Commands/scripts are verified in Linux Work/CI; native Windows execution was unavailable. Preserve personal changes before switching main. Use an ordinary OS account for the disposable PostgreSQL helpers.

```powershell
cd D:\Projects\vsph-control-center
git status --short
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run check
npm run check:migrations
npm run lint
npm run format:check
npm run test:coverage
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

The full audit currently reports six moderate development-tool findings through minimatch, with no high/critical findings; production audit is clean. Do not run npm audit fix --force: its suggested tool downgrades are not validated. See RISK_REGISTER.md. No typecheck/build script exists for this vanilla JavaScript application. npm run test:e2e without DB mode runs public checks and skips authenticated fixture journeys; test:e2e:db creates a disposable native database and runs the full suite. Fixture URLs must be empty loopback vsph_test, never hosted staging/production. Root OS execution deliberately refuses privilege/account creation.

Normal server requires privately configured Supabase `.env` plus `PUBLIC_ORIGIN=http://localhost:3000` and `PORT=3000`. The original 13 feature migrations were installed on the existing Free project on 2 November with an explicit restore-rehearsal waiver; see HOSTED_INSTALL_20261102.md. Do not rerun bootstrap, seeds or the legacy installer there.

This continuation adds four **unapplied** forward migrations, in order: `20261103050509_organization_workspace.sql`, then `20261103051256_delegated_organization_invitations.sql`, then `20261103053129_delegated_invitation_profile_locks.sql`, then `20261103062727_organization_owner_transfer.sql`. The new My organizations workflow requires them before normal runtime acceptance. Hosting and hosted installation are intentionally excluded from this continuation. Run `npm run test:e2e:db` to exercise the complete new workflow against disposable fixtures without touching Supabase. CSV export uses the existing project_report function and needs no additional migration. No real invitation email is sent by these test helpers.

After a prepared target has the reviewed functions: sign in as an existing customer owner/admin, open My organizations, review products/counts, update the display name, manage an ordinary member's status/product role, queue a synthetic invitation, renew/cancel and inspect activity after reload. Product-role changes require the actor's own explicit product administrator assignment; organization ownership alone is insufficient. Ordinary/unrelated/revoked users must be denied. See ORGANIZATION_WORKSPACE.md and MANUAL_QA.md for the complete permission/failure checklist.

## Project and engineering acceptance

1. Sign in at http://localhost:3000/login with an existing platform administrator. Open Projects, create internal/customer work, assign existing members/team roles, milestones and tasks, update statuses, add comments/evidence, reload and inspect progress/history.
2. An operator first registers/installs an approved GitHub App with Metadata/Contents/Pull requests/Actions/Checks READ and configures server-only GITHUB_INTEGRATION_ENABLED, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY. Optional signed webhook needs GITHUB_WEBHOOK_SECRET and approved HTTPS endpoint. These credentials/installation are not provisioned by the code or tests.
3. Engineering → platform administrator verifies installation ID for the project → manager discovers/selects an authorized repository → connect. Synchronize next page advances one durable category/page. Inspect real source links, PR/build/release state, source versus observation time, checkpoint/error/retry time. Link a PR/release explicitly to a task or milestone and reload. Disconnect and confirm private facts/links disappear. Test unrelated/client/revoked accounts separately.
4. Projects → Project inbox and reports: assignment/milestone/engineering notices, mark read, preferences and failed-delivery recovery. Filter reports by project/customer/owner/status/creation date; reconcile counts with persisted source work. Requested reviews do not mean approval. Retained failures do not mean latest branch failure. Vercel remains visibly unconfigured. Apply report filters, then download the first-100 project summary CSV; verify the downloaded records match the authorized report and keep the file private.
5. Projects → Your active sessions: review safe session timestamps, revoke one other session or all others, confirm linked product sessions end and the current portal stays active. No device or MFA claim is made.

After approved staging setup only, an operator/scheduler can invoke these finite server-owned batches:

```powershell
npm run github:sync
npm run notifications:dispatch
```

They persist sync/notification state in the configured database. They were not run against hosted customer databases in this execution. github:sync refuses disabled/incomplete App configuration. No hidden worker or background continuation is started by npm run dev. Do not run invitations:dispatch against real recipients as a development step; invitation provider remains off/unverified. Music SSO remains separately gated. Full manual cases are in MANUAL_QA.md, GITHUB_DELIVERY.md and ACCOUNT_SESSIONS.md.

## New readiness and reminder acceptance

After approved target setup, `npm run staging:inspect` performs read-only catalog checks using dedicated STAGING_DATABASE_* variables and explicit approval; do not point it at an undesignated live environment. `npm run github:verify` compares real provider facts and optionally an approved staged application session; see LIVE_GITHUB_ACCEPTANCE.md for its exact settings. Neither command applies migrations or certifies release readiness.

Migration 20261031065919_overdue_milestone_notifications.sql follows 007 and was included in the separately authorized 2 November installation. Create an unfinished overdue milestone with two explicit project managers in isolated staging; invoke the approved notifications dispatcher, verify one reminder per manager per UTC day, then test opt-out, completion before delivery, demotion and revocation. Product roles do not confer manager notifications.

`npm run test:restore:ci` is intentionally restricted to the identified PostgreSQL 17 Docker service in GitHub CI. It is not a general PowerShell restore command. Native Windows commands above are repository-supported and verified in Linux/CI, not executed on Windows here. See RESTORE_REHEARSAL.md and HOSTED_SCHEMA_FINDINGS.md for the separate hosted recovery gate.

## Phase 4 manual workflow

After approved isolated migration/Auth setup, sign in with a real staged platform identity. Administration → Users → Customer workspace: select a customer, inspect terms/members/invitations/history, queue one scoped invitation and review delivery/recovery separately. Accept with the intended staged identity; no synthetic fixture cookie is a production login method. Reissue/cancel using current generations, change/revoke explicit roles, test last-owner and wrong-actor denial.

Administration → Applications → Product registry: register a sandbox code and portal-only integration, save ownership/support/docs/visibility and reload. Edit with current version; exercise inactive/retired states and scoped local readiness. No metadata operation enables Music SSO, stores provider secrets or proves external health.

Customer workspace → lifecycle and entitlement controls: review stored impact, suspend/reactivate, change one product's grant and terms atomically, then verify session/code/capability revocation. Concurrent/stale updates must conflict. In legacy subscription/access forms, repeated edits must preserve the selected non-first tenant/product after lookup refresh. Verify unaffected customers. Follow MANUAL_QA.md for the full negative and responsive matrix.

Historical Phase 4 order: 20261101052745_member_governance.sql → 20261101053314_product_registry.sql → 20261101054139_customer_lifecycle.sql. Those migrations were installed on 2 November; the four new 3 November migrations listed above remain unapplied. No isolated hosted staging has been established, and real Auth/email/recovery acceptance remains separate from synthetic CI. Hosting is outside this continuation.

Current feature acceptance is 139 Node/32 native PostgreSQL/28 desktop/mobile Chromium cases. CI also compares restored indexes/security triggers and exercises populated duplicate-invitation rollback/forward repair. It does not certify Windows, hosted disaster recovery, real MFA/email, production load or WCAG.

To identify the effective local database reference without printing credentials, run `npm run config:inspect -- zbmerhexucqxazuxjmmw` from the same shell used for npm run dev. This reports only public host/ref and key presence, does not connect, and cannot classify a database as development. Exit 1 means missing/mismatched configuration. The old DATABASE_PREFLIGHT_20261101.md is historical; HOSTED_INSTALL_20261102.md records its later authorized installation. No additional hosted migration is authorized by this code-only continuation.

## Identity and ownership acceptance

Portal and application login now check enrolled TOTP/assurance server-side. Already-enrolled accounts require a current authenticator code; unsupported methods fail closed. Enrollment/recovery and old-session factor governance are not implemented. No live Auth setting or factor was changed. The existing `npm run test:e2e:db` command includes explicit fake-provider/native-database MFA fixtures; it does not require a real enrolled account.

After the reviewed ownership migration is installed in an appropriate target, My organizations → Transfer organization ownership: select an accepted active administrator from the current members page, review names/impact, acknowledge becoming an admin and enter your own password/current authenticator code when requested. The new owner does not inherit product/project permissions. Reload and inspect activity; wrong credentials, stale review or expired/session-mismatched proofs must deny. Existing higher-trust platform administration has separate permissions and is not universally step-up gated by this feature.

Read MFA_SIGN_IN.md, ORGANIZATION_OWNERSHIP.md and the identity/ownership section in MANUAL_QA.md. Exact merges, test scope, remaining M0–M12 work and four unapplied migrations are in docs/roadmap/IDENTITY_CONTINUATION_20261103.md. Hosting remains deferred; no Docker/WSL/AWS setup or paid cloud resource is needed for the disposable test helpers.

## Project work search continuation

The same install/Node/native-PostgreSQL/Chromium/lint/coverage/checksum/security commands above cover `/search`. The additional unapplied hosted forward migration is `20261103072229_project_work_search.sql`; no hosted application upgrade is implied. In the isolated browser helper, open the authenticated fixture dashboard drawer/sidebar → Search work, find project/task/milestone titles, filter and traverse 25-record pages, follow a project link, then retry as an unrelated fixture user. Normal `npm run dev` needs the reviewed migrations in its configured target; do not point disposable test commands at Supabase or customer data.

## Partial canonical history

`npm run check:migrations` still checks only local source/checksum registration. The read-only readiness assessor now reports genuine pending canonical gaps without spuriously reclassifying existing aliases as legacy, while blocking marker drift/unknown/duplicate entries. [Read the target inspection/installation boundary](PARTIAL_MIGRATION_HISTORY.md); `staging:inspect` still requires an explicitly approved isolated target and TLS verification. Do not point it at a potentially live candidate by weakening its guards. The new logic is covered by Node and disposable native tests, with no new SQL migration.

## November 4 database/dashboard repair

The six previously missing source migrations are now installed on the existing configured project. Do not rerun the legacy installer or seed. Pull current main, restart the server, and use the [repair-specific Windows commands and acceptance workflow](HOSTED_REPAIR_20261104.md). The broader owner dashboard now displays independent real operating/finance modules. Existing finance records were not fabricated; the new ledger starts empty.

## HRMS and own profiles

The profile and HRMS migrations are installed on the existing configured target; see [installation evidence](HRMS_INSTALL_20261104.md) and the [role-based HRMS walkthrough](HRMS_WORKSPACES.md). Pull current main and restart the server. Do not rerun the old legacy installer or seed. `/hr/access` is owner-only, `/hr` is owner/current HR, `/my-work` requires employee consent, and `/account/profile` edits only the signed-in user's personal presentation. No Docker, AWS, paid staging resource or real email is required for the isolated tests. Full live Auth/MFA acceptance and hosted restore remain unverified.

## Performance continuation — 4 November 2026

Pull latest main, stop/restart `npm run dev`, and hard-refresh. Licensed Inter loads locally; HR navigation discovery no longer delays owner dashboard reads. Current-session authentication uses one fresh joined read. The owner operating endpoint uses one snapshot RPC, plus authentication and a fresh owner fence (three database requests in total). The reviewed read-only migration is installed on the existing configured target; no reset, seed or legacy installer is required. See [performance evidence and limits](PERFORMANCE.md).

Run the same Node/check/lint/format/coverage/checksum commands above. `npm run test:db:local` and `npm run test:e2e:db` use disposable data; Chromium defaults to two workers without relaxed timeouts. Verify login, owner dashboard refresh, Projects, own profile and admin on desktop/mobile, then check HR/customer denial and logout. A localhost server still reads remote Supabase; actual workstation latency is unmeasured.

## Shared navigation and role testing — 5 November 2026 handoff

Navigation/role-workspace PR #77 is merged (`43bca84f180541495c97378fe00f33f585661a71`). Pull main, install and restart your normal portal:

```powershell
cd D:\Projects\vsph-control-center
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run check
npm run dev
```

For the separate, disposable role-testing workspace, open another PowerShell terminal in the repository and run `npm run demo:local`, then open **http://127.0.0.1:3001/login**. Use the [exact role logins and manual acceptance workflow](NAVIGATION_AND_ROLE_TESTING.md). This is independent of normal localhost:3000 and uses simulated Auth; it creates no hosted users, sends no email and needs no Docker, AWS or paid resource. Ctrl+C removes its temporary database; page reloads within the running workspace preserve saved work. Do not run the legacy seed or reset.

Additional verified commands: `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run check:migrations`, `npm run test:db:local`, `npm run test:demo`, `npx playwright install chromium`, and `npm run test:e2e:db`. Run native helpers as an ordinary OS user. No standalone TypeScript typecheck script exists; `check` validates JavaScript syntax. Current CI: 162 Node, 44 PostgreSQL, one interactive smoke and 68 Chromium passed/two intentional skips per launcher; production audit clean, six moderate development findings unchanged.

## HR appointment repair — 5 November 2026

PR #79 removes the misleading direct grant path. Pull main and restart the server; no migration, seed or reset is needed for this repair.

```powershell
cd D:\Projects\vsph-control-center
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run check
npm run lint
npm run format:check
npm run check:migrations
npm run test:coverage
npm run dev
```

For isolated PostgreSQL/Chromium, use the native helper commands and prerequisites documented above (`npm run test:db:local`, `npx playwright install chromium`, `npm run test:e2e:db`). They use disposable local data, not the hosted project.

Owner: open Employees, search the employee, select **Review HR access**. Check the reported prerequisite. A roster with no matching account must not show an enabled grant or consent-request control. For an existing ordinary active account: request consent, log in separately as that employee, accept in **My employment** with password/MFA, then refresh as owner and grant. Verify HR cannot appoint HR, customer cannot open HR, staff cannot see another employee's records, and revocation removes HR access on the next request. Check row buttons remain separated at desktop/mobile sizes and the sidebar can collapse, expand and navigate throughout.

The reported `ayan@vsph.test` has no hosted Auth identity/profile or accepted link at investigation time. Enrollment is still required; pulling this fix does not manufacture a login or accept consent. [Detailed diagnosis and limits](HR_ACCESS_TROUBLESHOOTING.md).
