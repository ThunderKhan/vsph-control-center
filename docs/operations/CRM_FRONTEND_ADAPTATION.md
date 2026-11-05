> **Current navigation:** the later user instruction replaces the sidebar with [horizontal top navigation](TOP_NAVIGATION.md). Sidebar/collapse details below describe the previous implementation. Role boundaries and account-testing limits still apply.

# CRM frontend adaptation

Source: [hrithik41/CRM](https://github.com/hrithik41/CRM), commit `43f1509dae60a5156837618fb5b726ec05b56946`, inspected at the user's direction as their boss's frontend. The classic Navbar, V2 sidebar, login split and shared input/table styles were read and compared at that pinned commit. The source also includes placeholder screens and browser-local user state; these are not security or backend implementations to transplant.

## Applied design

- Classic navy two-row header, centered work search, application launcher and profile avatar.
- V2 compact grouped sidebar, blue active state, round profile avatar and consistent light tables/forms.
- Split login with navy introduction and white form, retaining existing login fields, product selection, password visibility, MFA and server controllers. The obsolete decorative canvas is no longer loaded.
- Existing VSPH company overview remains at `/dashboard`, including persisted KPIs, charts, layout and refresh behavior. Its source markup is untouched. Git preserves its complete earlier implementation; the dashboard and applications receive the shared CRM-style chrome.

VSPH's `DESIGN.md` remains authoritative for Inter, navy/blue/white colors, flat surfaces, accessible contrast and 44 px targets. UBS logos, third-party branding, fake counters, nonfunctional actions, external font loads and localStorage identity handling are not imported. Existing Express/vanilla JS architecture is preserved instead of introducing a second React application. This is an adaptation of the source design to working VSPH modules, not a claim that all the source CRM's business modules were imported.

## Real interactions and privacy

Header search calls the existing authorized `/api/search` API with no-store and a bounded timeout. It shows at most ten project/task/milestone matches and links to authorized project IDs. Search text lives only in the page's memory, not browser storage or navigation URLs. Editing/closing aborts stale requests; failures clear results. Results render as text, not HTML. The advanced search link opens the existing complete work search. It does not claim to search unsupported private repository contents or contacts.

Launch/profile/owner actions link to real existing routes. Owner controls remain hidden for ordinary accounts and protected server-side. Collapse/expand, mobile drawer, focus/inert behavior and role-specific navigation retain their existing controller. Logout still revokes server sessions. Product and customer roles remain separate from internal HR/project assignments.

## Acceptance and rollback

Node rendering tests cover escaped identities, one shared sidebar/menu button, hidden owner actions, preserved content and external scripts under existing CSP. Chromium checks both viewports: dashboard remains present; header search safely renders markup-like results without interpreting HTML; query text does not enter the page URL; Escape closes results; profile navigation and split login work; and the full existing role, customer, HR, onboarding, finance and project suite remains required.

Screenshots are attached to Chromium CI artifacts. Test Auth is simulated and database data isolated; real hosted login/account provisioning still requires the operator's configured environment. No new migration, provider, credential or database change is required by this frontend. Revert the new styles/header/search modules to restore earlier presentation without changing durable data.
