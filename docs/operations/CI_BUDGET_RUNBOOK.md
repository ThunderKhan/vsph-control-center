# Actions budget and local verification

## Why the workflow changed

The private repository's GitHub-hosted Actions allowance has been exhausted. The old `Node checks` workflow launched five jobs (quality, PostgreSQL, browser, dependency audit, production container) on **every PR commit and every push to main**. That is expensive during active feature development, and exhausted billing can mark all jobs failed before a runner executes.

The workflow is now deliberately **manual only** (`workflow_dispatch`). Normal pushes, PR updates, and merges do not start hosted runners. This is a billing control, **not evidence that CI passed**.

## Developer workflow (Windows / Linux / macOS)

Use Node 24 and an isolated development checkout. Do not supply a hosted Supabase connection string to local fixture tests.

For rapid iteration:

```powershell
npm ci
npm run verify:fast
```

For a proposed release or a merge containing migrations:

```powershell
npm run verify:release
```

The release command installs locked dependencies and then runs unit tests, source checks, migration source validation, lint, formatting, coverage, isolated PostgreSQL integration, isolated Chromium browser tests, demo startup/shutdown, and both production/development high-severity npm audits.

Each run writes a JSON receipt in the gitignored `.local-verification/` directory with its **commit SHA**, lockfile hash, platform, Node version, exact commands, durations, and outcomes. A failure stops subsequent tests and marks the receipt failed. An uncommitted checkout is marked dirty and is not suitable as a release attestation.

A successful local receipt does **not** replace the full independent security review, production container smoke, isolated backup/restore rehearsal, or hosted database migration approval.

## Optional, explicit GitHub Actions runs

When hosted runner capacity is available, open **GitHub → Actions → Node checks → Run workflow**. Select the reviewed branch and only the desired suite:

- **`quality`** — Unit, lint, source, coverage, formatting. Explicit pre-merge review.
- **`database`** — PostgreSQL isolation, advisers and backup/restore rehearsal. Any schema, permission or migration change.
- **`browser`** — Chromium browser acceptance tests. Navigation, onboarding or UI changes.
- **`dependencies`** — npm production + development audit. Dependency updates / releases.
- **`container`** — Production image and anonymous route denial. Deployment changes.
- **`all`** — All five suites. Final release check when budget permits.

No option is selected automatically by commits. A manual run uses GitHub minutes; do not dispatch while the budget remains blocked.

## Merge policy while the account is over budget

1. Use an up-to-date, clean checkout at the exact PR head; record a `verify:release` receipt and manually inspect the diff.
2. If there are migrations, compare the canonical migration ledger against the hosted database, perform an **independent off-site backup and restore rehearsal**, and approve a controlled release plan. Local fixture tests alone do not authorize a hosted migration.
3. Don't claim green GitHub Actions from a blocked run. If repository protection requires a named check, **do not bypass branch protection**; keep the PR open until the requirement can be satisfied or an authorized repository administrator makes a reviewed policy change.
4. Merge only approved, tested source. Installing a migration, enabling a new feature in production, or deleting customer records are separate controlled operations.

Do not configure a self-hosted runner on a developer workstation without an explicit security review: repository code and PR workflows can execute arbitrary commands on that machine. A dedicated isolated runner with limited permissions is a possible future optimization, not a default workaround.

## Restoring hosted CI later

When the billing period resets, review actual utilization first. Then decide whether to re-enable inexpensive PR checks selectively. Preserve manual heavy suites, concurrency cancellation, and the local release verification receipt so ordinary WIP commits cannot consume the monthly allowance again.
