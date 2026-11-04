# Owner dashboard: VSPH bento workspace

The supplied Web3Bento reference is adapted into the existing Express/vanilla JavaScript dashboard. The composition, selectable card stack, semicircular gauge, period controls and chart inspection are retained as company operations. React/Tailwind, cryptocurrency content, random walks, simulated updates, count-up money and demo fallbacks are not imported.

Root `DESIGN.md` governs the result: Inter, neutral/white surfaces, navy emphasis, blue actions, selective light-blue data accents, a twelve-column desktop grid, flat cards without shadows, labelled controls, visible focus and reduced-motion support. Decorative arrow links and underlines are removed from the main owner dashboard. Mobile controls retain 44-pixel targets; month selectors wrap rather than overflow.

| Widget                         | Persisted source and meaning                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company metrics                | Exact counts of active organizations, projects, employee roster records and registry products                                                                        |
| Cash pulse / collections chart | Six calendar months from the existing exact finance report; 1M/3M/6M controls select actual months, and focus/click inspects exact decimal-string paise              |
| Product stack                  | Up to three allowlisted registry records; keyboard/click reorders the cards, and Manage products opens administration. Registry status does not grant product access |
| Task completion                | Done tasks divided by noncancelled tasks; no percentage when the denominator is zero                                                                                 |
| Work distribution              | Done, blocked and other open tasks; cancelled tasks are excluded. Inconsistent concurrent observations make only this section unavailable                            |
| Attention                      | Open tasks and unfinished milestones whose due date is before the server's current UTC calendar date                                                                 |
| Upcoming milestones            | Up to five planned/active milestones due today or later, ordered by due date; these are scheduled dates, not forecasts                                               |
| People                         | Internal roster counts by active/onboarding/other states; no utilization score or fabricated employee portraits                                                      |
| Active projects / activity     | Up to six recent active project summaries and six stored project events; action/date/project link only, without actor identities or integration secrets              |

`GET /api/admin-management/dashboard` remains behind current session/platform-owner checks and a post-read active-owner recheck. Unsupported filters are rejected and responses are not cached. The additions use existing tables only: no database migration, seed, account change or hosted mutation is required. A read-only hosted privilege check confirmed server SELECT and denied anon/authenticated SELECT on all four newly used query sources.

Each section owns its availability. Clearing or denying a read clears its charts, counters and product cards, including bodies arriving after a newer refresh or an access denial. The finance report retains its exact-money validation, twelve-second deadline and separate failure state. No data is estimated to populate an empty chart. The explicit illustrative preview is separate; ordinary members retain their existing application-access dashboard.

Acceptance includes the existing full security/database/browser suites plus bounded-query/allowlist/failure tests, an authenticated database-backed project/milestone/task setup, date serialization matching PostgREST, real upcoming/overdue records, keyboard product selection, chart ranges/month inspection, reduced motion, no horizontal overflow and desktop/mobile screenshots. Provider mocks or UI fixtures are never described as live production evidence. See the PR's actual CI results for final outcomes.

To review locally, pull main, run `npm ci`, `npm test`, `npm run check`, `npm run lint`, `npm run test:db:local`, and `npm run test:e2e:db`, then `npm run dev`. Visit `/dashboard` as the owner and inspect populated, empty and failed modules. The local database/browser helpers are disposable and do not seed the hosted project. No additional deployment or schema-install command is needed for this increment.

Acceptance record: [PR #69](https://github.com/ThunderKhan/vsph-control-center/pull/69). The feature run passed 159 Node, 40 native PostgreSQL and 56 Chromium tests, with two intentional browser skips. Subsequent keyboard skip-target acceptance caught a duplicate ID; corrected to one focusable main landmark and rerun before merge. GitHub records the final accepted head and merge SHA. Desktop/mobile images use isolated database-backed project, task, milestone and finance records. No live customer data was created for screenshots.
