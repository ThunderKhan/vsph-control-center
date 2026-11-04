# Portal navigation and isolated role acceptance

The authenticated portal uses one sidebar template (`views/partials/portal-sidebar.html`), one server renderer (`services/portal-page.js`) and one navigation controller (`public/portal-navigation.js`). The renderer decorates only reviewed HTML paths after existing route authentication/authorization; APIs, assets, anonymous login and invitation pages are unchanged. Current identity text is escaped. It does not grant permissions or cache authorization. Module HTML/content is preserved. Dashboard and Projects no longer own competing sidebar controllers.

Desktop collapse/expand can be repeated and persists across full-page navigation using `vsph.sidebar.collapsed`. Mobile uses a separate drawer: Escape/backdrop closes, focus returns, background content is inert while open and resizing to desktop closes it. Every icon-rail link keeps a title and accessible name. Longest matching route selects the active item. The shared account footer opens your own profile and signs out. A failed capability request offers retry; it does not silently invent HR access. Module saves no longer disable sidebar controls.

Owner navigation includes customers, products, onboarding/recovery, finance, HR and HR governance. Current HR sees HR management and employee tools, but not HR grant/revoke or platform administration. Employees get their own work and pending/accepted employment link; customer profiles receive their authorized product/organization/project routes. All underlying server/RPC boundaries still enforce current session, tenant and membership. Hiding a link is not the authorization mechanism.

## Isolated interactive accounts

Do **not** run `npm run seed` or reset the configured Supabase project. The connector cannot create password-based Supabase Auth users. No hosted users, roles, records or real emails are created by this feature.

From an ordinary Windows PowerShell session:

```powershell
cd D:\Projects\vsph-control-center
git switch main
git pull --ff-only origin main
npm ci
npm run demo:local
```

Open **http://127.0.0.1:3001/login**, separately from the normal server at localhost:3000. The process starts a fresh native PostgreSQL database, applies the source schema/migrations only there, adds labelled fixtures and uses the existing simulated Auth provider. The portal displays an isolated-test notice. It never accepts a supplied database URL or contacts Supabase, SMTP, GitHub or live Music SSO. No Docker, AWS or paid resource is required. First use may download the native PostgreSQL package. Stop with Ctrl+C to close and remove the temporary database; restarting creates fresh records. These accounts do not work on your normal hosted-backed portal.

All listed isolated logins use **`fixture-password-only`**, which is a public fixture password, not a production credential.

| Purpose              | Isolated login               | Expected access                                                                                                     |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Platform owner       | `admin@fixture.test`         | Complete owner navigation, employee/HR governance and platform administration                                       |
| HR manager           | `hr-desktop@fixture.test`    | HR workspace, employee directory/onboarding, own work; cannot appoint HR or open platform admin                     |
| Employee             | `staff-desktop@fixture.test` | Own assigned task, own attendance and leave; cannot see employee directory, HR review or another employee's records |
| Music customer owner | `music@fixture.test`         | Own customer organization and Music entitlement/product role; no CRM or internal HR/employee/finance access         |

The Music customer has product `super_admin` within its own organization, **not** platform `super_admin`. A QA Music request belongs only to that organization. The external Music deployment and SSO are not verified by these fixtures. The two internal fixture layouts (desktop/mobile) are separate so tests do not overwrite one another's work.

## Acceptance workflow

1. Owner: open Dashboard → Projects → Customers → Product registry → employee onboarding → HR access → finance → profile. Every permitted page has one sidebar. Collapse/expand repeatedly, navigate and reload; the preference persists. Test at 390px and 1440px. Mobile opens/closes with its buttons, backdrop and Escape; keyboard focus remains in the open drawer.
2. HR: sign in separately, open HR workspace, inspect employee directory and review employee leave/attendance. HR access/governance and platform admin must be absent; direct requests to `/hr/access` and `/admin` return 403.
3. Employee: open My work, update its assigned task and reload; check in/out; request leave. No directory or HR review access. Sign out, log in as HR, review that request, then log back in as employee and confirm the persisted decision. Fixtures reset only when the demo process stops/restarts.
4. Music customer: Applications contains only Music. My organizations contains its own organization. HR, employee, owner and finance endpoints deny. CRM login denies. Use the existing second-stage local Music login to verify its own product context; a public external demo is not SSO.
5. Simulate capability loading failure, retry it, and verify the sidebar remains usable. During slow form saves, collapse/expand and mobile close remain enabled. Logout must end the portal session; protected navigation afterward returns to login.

## Checks and limits

`npm test`, `npm run check`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run check:migrations`, `npm run test:db:local`, `npm run test:demo`, and `npm run test:e2e:db` cover this work. Chromium installation: `npx playwright install chromium`. The interactive smoke test signs in through the real portal HTTP routes backed by disposable PostgreSQL and the simulated provider, asserting HR/employee/Music denials. Native helpers deliberately reject root rather than creating OS users. Browser tests cover consistent menus over fifteen routes and role boundaries on desktop/mobile. Test execution results and any queued CI gates are recorded in the PR/report; writing a test is not evidence that it passed.

Live Supabase Auth accounts require an authorized Auth Admin API operation or the provider dashboard with private credentials. These simulated accounts do not prove live Auth/MFA/email, production Music SSO or hosted deployment readiness.

## Verified acceptance

PR [#77](https://github.com/ThunderKhan/vsph-control-center/pull/77) merged as `43bca84f180541495c97378fe00f33f585661a71`. [CI run 41871496727](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41871496727) passed 162 Node tests, 44 PostgreSQL cases, the interactive sign-in/denial smoke and 68 desktop/mobile Chromium tests (two intentional skips) through each launcher. Its `browser-report` artifact contains the screenshots. The final checks also verified a complete synthetic restore and isolated advisors. These are isolated acceptance results, not live Supabase Auth/MFA or external Music SSO evidence. The launcher clears inherited PostgreSQL and provider configuration and suppresses `.env` loading only within its own test process; your normal environment/file is unchanged.
