# Horizontal portal navigation — 5 November 2026

The user's latest instruction replaces the sidebar/icon rail with CRM-style horizontal top navigation. It supersedes earlier requirements to keep a collapsible sidebar. The shared server header now owns one Main navigation on every authenticated page, including protected product logins and error pages. No side column is reserved. Existing dashboard business content remains unchanged.

## Layout and behavior

The upper row contains VSPH, authorized work search, application launcher, account/profile menu and server-backed sign out. The second row groups Overview, Work, Organizations, Applications, People and Administration. Work contains Projects, My tasks for authorized employees, and reports. Organizations contains My organizations and owner-only customer administration and Client onboarding. Applications contains the launcher and owner-only catalog. People groups employment, the employee directory, Employee onboarding and permitted HR tools. Administration contains platform governance, invitation recovery, finance and audit. The separate Search work tab was removed; the header search still offers the advanced `/search` page. No product role or tenant entitlement is inferred from menu visibility.

On smaller screens the menu opens downwards below the header. It is a nonmodal disclosure, not a side drawer: ordinary Tab navigation remains available, Escape closes the current dropdown or expanded mobile menu and returns focus to its opener. Enter/Space use native summary behavior; arrow keys/Home/End move through dropdown links. Clicking outside closes menus. Only one dropdown is open at a time. Current pages mark their exact link and parent section.

Old `vsph.sidebar.collapsed` storage is ignored, so an old icon-rail preference cannot bring the sidebar back. The first-paint Applications/Overview distinction is preserved using a same-origin external script. CSP now uses `script-src 'self'` without an inline prepaint exception.

## Permissions and regression checks

Server authentication and route/API authorization are unchanged. Current HR capabilities are read from `/api/hrms/access`; a failed lookup shows a retry control and does not invent permission. Customer accounts cannot obtain internal HR/owner tools by opening a dropdown or guessing URLs. Profile edits, search and sign out retain their existing server APIs and privacy boundaries.

Chromium acceptance covers 15 routes on desktop/mobile, full-width content, ignored legacy rail preferences, repeated mobile open/close, real People/Administration/Profile navigation, keyboard focus, sign out with an independently created session and existing cross-role/product/tenant denials. Screenshots are attached to browser CI. Native PostgreSQL, Node, syntax/lint/format/coverage, dependency, migration and synthetic restore checks remain required.

The navigation and creation-screen changes require no migration, account, provider, credential or hosting change. Rollback is an application-source revert; durable records are unaffected. The existing project-scoped `manager` role remains the authority for assigning project team members and tasks. Creating a customer organization still uses the reviewed durable customer onboarding flow; creating an organization without products and registering a first-class custom project application are separate future domain changes and must not be impersonated by a frontend-only form.

## Local acceptance

Pull main, run `npm ci`, `npm test`, `npm run check`, `npm run lint`, `npm run format:check` and `npm run dev`. Refresh with Ctrl+F5. Check Dashboard, Applications, Projects, People, Administration and Your profile. At 390px and 320px verify the menu opens below the header, no side rail returns and controls remain reachable. Recheck HR/employee/customer menus and direct URL denials. Open the account menu, follow Your profile and use Sign out.

## November 9 follow-up

The customer directory now offers **Create customer project**, preselecting only an authorized active organization returned by the server. Its query parameter is UI context, not an authorization capability. Project creation uses a three-step wizard, followed by project-scoped manager and employee assignment. Project Applications has two distinct groups: linked VSPH catalog products and custom project applications.

The customer wizard also offers **Custom development only**. Selecting it bypasses subscription configuration, preserves explicit review/confirmation and queues the usual owner invitation. Two additive source migrations are required for the new database-backed workflows: `20261109140000_project_custom_applications.sql` and `20261109141500_organization_only_onboarding.sql`. They were not installed against a hosted target as part of this source update. Keep the UI release gated on actual target migration verification and provider acceptance.
