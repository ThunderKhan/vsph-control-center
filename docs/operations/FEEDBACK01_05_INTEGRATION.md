# Combined project-workspace integration (Feedback #1–#5)

This branch starts from `main` after Feedback #1–#4 ([PR #99](https://github.com/ThunderKhan/vsph-control-center/pull/99)) and the Actions budget control ([PR #100](https://github.com/ThunderKhan/vsph-control-center/pull/100)). It incorporates the focused project experience from Feedback #5 without undoing the existing creation, lifecycle, Notifications, Work Reports, or Account Security changes.

## Combined user journeys

- From **Projects**, the authorized owner creates a project in the centered modal, optionally selecting an eligible manager, reviews the details, and gets a persisted confirmation.
- Portfolio project links use their human-readable key. Older `/projects/<uuid>` links still resolve to authorized records and update to `/projects/<KEY>` without changing internal UUID-based APIs.
- A project opens on a focused Overview with next actions, a milestone roadmap, risks, resources, and weekly status updates. Tasks, Milestones, Team, Applications, Delivery, Engineering, Activity and Settings are individually navigable views instead of a single long anchor-scrolling page.
- Milestones have expandable, circular-tick checklists with assignee-limited writes, per-stage and overall completion, and separate formal milestone sign-off.
- The archived-project deletion rule refuses projects with retained checklist, project, financial or delivery references. No customer data is cascaded.
- Notifications and Reports remain outside the project portfolio; active sessions remain under Account → Security.

## Additive migration ordering

The canonical manifest has **37 source migrations** and ends with:

1. `20261109193000_feedback01_04_lifecycle.sql`
2. `20261109203000_project_workspace_v2.sql`

Both are **pending source files**, not authorization to install them on the hosted company database. The V2 migration is registered with a checked SHA256 checksum, explicit predecessor dependencies, RLS, and service-only RPC permissions.

## Release verification (run from this exact clean branch)

```powershell
git fetch origin
git switch integration/feedback01-05-20261109
git pull --ff-only
npm run verify:release
```

The last command generates a gitignored receipt in `.local-verification/`. It runs locked dependency installation, unit, lint, code, migration, coverage, local PostgreSQL, browser, demo and high-severity audit checks, stopping on failure. See `docs/operations/CI_BUDGET_RUNBOOK.md`.

Project-specific acceptance requires:

- Create with and without a manager, confirm returned names and URLs, assign a project employee.
- Open an existing UUID and key URL; use keyboard/desktop/mobile navigation for every project view.
- Create checklist items, toggle and reopen, refresh and confirm persisted progress without auto-approving the milestone.
- Record a risk, resource link and weekly update; confirm private customer access remains denied.
- Archive and attempt deletion on both empty and retained-data projects; assert retained project stays archived and unchanged.
- Re-onboard and restore an archived employee without reviving previous account, HR or project privileges.

**No GitHub-hosted runners are dispatched automatically.** The hosted Actions billing budget is exhausted. Local passing checks are necessary but do not replace the independent source review, database backup/restore rehearsal, canonical hosted-ledger check and approved migration/deployment window.

## Current integration limitations

The combined branch and static regression assertions are committed. Full isolated PostgreSQL and browser verification of the **combined** 37-migration state is still required. Do not merge this branch or install either migration solely based on the prior passing tests for Feedback #1–#4.

## Security and migration hardening during integration review

A read-only code review found a broken, truncated checklist assignee clause and an obsolete duplicate SQL action block **after** the workspace function's closing grant. This was a source defect inherited from the standalone Feedback #5 branch, not evidence of a failed hosted upgrade. The integration branch now has one complete function, explicit assignee authorization, and one final grant. It also:

- Re-evaluates the actor's current project role *after* the project row lock, to avoid using a stale manager role for a write.
- Returns only progress-safe checklist fields to authorized customer viewers of shared milestones (not internal staff IDs or audit metadata).
- Prevents customer-role users from opening the Engineering section through view navigation.
- Adds a source integrity regression test and extends isolated database assertions for shared checklist privacy.

**Verification constraint:** These corrections were checked at the source/integration-contract level, including a verified migration SHA256 in the canonical manifest. The updated workspace SQL must still be executed by `npm run verify:release` on the isolated local PostgreSQL fixture before merging PR #101. Source checks do not replace SQL execution.
