# Feedback #05 — Individual project workspace redesign

**Implementation branch:** `feedback/project-workspace-redesign-20261109` · **PR:** [#98](https://github.com/ThunderKhan/vsph-control-center/pull/98)

## Included

- Focused project Overview with task-progress cards, next actions, compact milestone roadmap, open risks, resources and the latest manager-written weekly updates.
- Separate navigable Tasks, Milestones, Team, Applications, Delivery, Engineering, Activity and manager-only Settings views. Existing editing APIs, governance and project data remain in place.
- Human-readable project keys such as `/projects/MUSIC?view=tasks`. The UUID remains the database identity. Existing `/projects/<uuid>` bookmarks are resolved and rewritten in the browser after authorized detail loading. Key lookup uses an authenticated server route, then the existing project permission RPC.
- Milestone checklists with expandable rows, accessible circular completion buttons, assignee selection, per-milestone and overall progress bars, and an auditable change history. Completion does not silently mark the underlying milestone done.
- Manager-authored risks with severity, open/resolved status and accountable manager. Managers can archive project resource links, and publish immutable project-status updates with optional customer sharing.
- Mobile, tablet and desktop breakpoints, restrained 180–280 ms interactions and `prefers-reduced-motion` support.
- Project Inbox and Active Sessions are suppressed **on individual project pages only**, consistent with Feedback #1. Their eventual relocation from the portfolio page into global navigation/profile is a separate feedback item.

## Data and security

The additive source migration `20261109203000_project_workspace_v2.sql` creates:

- `project_checklist_items`
- `project_risks`
- `project_resources`
- `project_weekly_updates`
- `project_workspace_command(uuid,text,uuid,jsonb)`

All new tables have RLS enabled and direct browser role privileges revoked. Mutations use an authenticated portal actor, current project permission, project version, atomic audit/activity and PostgreSQL row locking. Managers can create/manage records, assigned contributors can toggle their own checklist items, and clients only see explicitly shared updates/resources and checklist items under shared milestones. Service-role access does not bypass the RPC's actor checks.

No existing project, milestone, task, employee, customer, subscription, Auth identity or audit record is deleted or rewritten by the source migration. Resource removal is an auditable archive.

## Release boundary

**Source implementation is not an installed production migration.** The connected existing Supabase Free project has 44 canonical migrations at the November 9 verification point. The new migration is the next pending version. Do not run a general `db push`, reset, seed, historical migration repair or `apply_migration` with an unreviewed generated version against that target.

An off-site private backup, independent restore rehearsal, exact canonical ledger verification, SQL review and explicit maintenance approval are required before installing it on that company database. Existing project pages should remain usable if the new workspace RPC is unavailable; the supplementary cards display an upgrade-needed notice and do not claim that missing data is empty.

## Development testing

From an isolated checkout of this branch:

```powershell
npm ci
npm test
npm run check
npm run check:migrations
npm run lint
npm run format:check
npm run test:db:local
npm run test:e2e:db
```

`npm run demo:local` starts an isolated disposable PostgreSQL demo at http://127.0.0.1:3001, with simulated Auth, and may be used to preview the views without touching the hosted database.

The existing Playwright desktop/mobile project workflow was updated to use key URLs and actual view links. New regression tests cover a project workspace's persisted checklists, risks, resources and updates, version conflicts, client-private data and anonymous RPC denial.

### Acceptance checklist

- Existing project opening, editing, milestones, tasks, team membership, custom applications, GitHub delivery, and activity still work.
- `/projects/MUSIC`, `/projects/MUSIC?view=milestones` and older UUID links resolve only for permitted users.
- Adding/toggling an assigned checklist item persists across reloads and updates progress without auto-approving the milestone.
- Risks, resource links, and weekly project updates survive reload; unshared data never appears for a client viewer.
- Side-scrolling remains within the project tab strip on narrow screens; the page has no unwanted horizontal overflow.
- Reduced motion is respected. Status confirmations appear only after PostgreSQL accepts the write.

**Do not merge or install solely because the code parses.** The required automated and database tests must complete successfully. GitHub Actions was returning failed jobs without any executed steps during the initial PR audit; that is an execution-environment blocker, not a passing or failing test result.
