# Deployment handoff: Express application and database installation

This repository is the deployment source for VSPH Control Center. Music is a separate product/deployment. The portal uses Express and vanilla browser assets; deploy it as a Node web service, not as a static site or an assumed Next.js project.

## Current release gate

The user-confirmed local configuration targets zbmerhexucqxazuxjmmw. Read-only recheck on 2 November 2026 still finds six Auth users, six organizations and eight subscriptions, with no applications.visibility, customer_command, project_command or migration ledger. It is potentially live. No migration, backup export, hosted restore, credential change, plan upgrade or production deployment is recorded here. The backup/recovery gate remains mandatory. The installer is reviewed code, not permission to run it on that populated target.

The user requires the existing Supabase project to remain Free, with no new project/branch. Continue isolated native acceptance locally/CI. Actual hosted backup recovery and Auth/PostgREST acceptance remain unverified. Do not substitute fixture results for those release gates.

## Application setup

Deploy on Node 24 LTS and use the committed package-lock.json; all CI jobs use Node 24. The package engine floor (>=20.19) is a compatibility declaration, not a recommendation to deploy Node 20, which is end-of-life. See the [official release schedule](https://github.com/nodejs/Release/blob/main/README.md). No frontend build is needed.

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
npm run test:db:local
npm run test:e2e:db
```

Chromium must be installed before running browser tests: npx playwright install chromium. Native helpers require a regular OS user and disposable loopback databases; never point tests at the hosted target. The Work environment only maps UID 0, so native/browser verification is performed by existing non-root CI services/helpers.

For production, configure the existing server-only variables through the deployment provider's secret manager:

| Variable                 | Requirement                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| NODE_ENV                 | production                                                                                 |
| PORT                     | Provider-assigned port or 3000                                                             |
| PUBLIC_ORIGIN            | Exact externally served HTTPS origin                                                       |
| SUPABASE_URL             | Approved project's HTTPS API URL                                                           |
| SUPABASE_PUBLISHABLE_KEY | Approved project's publishable key                                                         |
| SUPABASE_SECRET_KEY      | Server-only secret/service-role key; never include in frontend bundles or Git              |
| TRUST_PROXY              | Only reviewed proxy IPs/subnets; omit until established; never true or a numeric hop count |

Production install/start: npm ci --omit=dev, then npm start. Keep demo seeding disabled. Existing invitation/GitHub/Music integrations stay disabled unless separately configured and verified. Configure scheduled invitation, GitHub and notification workers only with approved provider access and recipients; app startup does not schedule them. See the existing provisioning, Projects, integration and Windows guides for their explicit configuration.

## Generate a reviewable database package

Run from the source checkout with dependencies installed. This command has NO database connection, reads no credentials, and writes code artifacts only. The output directory must not already exist.

For the inspected legacy candidate, generate the package for review:

```powershell
npm run db:package -- --mode legacy --project-ref zbmerhexucqxazuxjmmw --output D:\VSPH-legacy-install-review
```

For an approved, genuinely empty Supabase target, replace the reference and choose fresh mode:

```powershell
npm run db:package -- --mode fresh --project-ref YOUR_20_CHARACTER_REF --output D:\VSPH-fresh-install-review
```

The second example contains a placeholder, not a ready-to-execute target. Both modes produce install.sql, plan.json and a canonical supabase/migrations directory. plan.json explicitly says applied=false, backupVerified=false and releaseReady=false. SQL comments bind operator intent to the chosen public project reference; SQL itself cannot authenticate a Supabase project reference. Verify the actual connection independently with config:inspect and the provider dashboard. Copying an SQL file to an operator does not authorize execution.

The installer:

- Verifies all original source checksums and dependency order. Original migration files and manifest hashes are unchanged.
- Uses a single transaction, an advisory lock, a 2-second lock timeout and 60-second statement timeout. Failure must be rolled back; no partial ledger or feature schema is committed.
- Fresh mode refuses public tables/views/foreign tables or existing Auth users. Bootstrap product inserts run only here.
- Legacy mode requires exact captured historical columns/defaults/nullability/RLS/constraints/indexes, takes write-conflicting locks, rechecks the catalog, and never replays schema.sql or product seeds. Existing migration namespaces, schema drift, repeat installation and partially upgraded targets are refused; they require an individually reviewed forward-repair plan.
- Installs all 13 feature migrations, checks application table RLS/browser denial and function grants, records history, and requests PostgREST schema-cache reload on commit.

## Historical version reconciliation

The canonical package explicitly maps the existing baseline to 20261030000000_vsph_verified_baseline, the two Music files to 20261030000100 and 20261030000200, and retains subsequent versions. plan.json maps each source path and checksum to the canonical version. Each standard migration-history row includes the original source SHA-256 marker. Legacy baseline adoption is verify-only; fresh installation executes bootstrap. This is explicit, source-preserving history adoption, not a blind migration repair.

Future CLI operations must use the package's canonical migration workspace, not the original colliding folder. Do not run db push/reset/repair against the legacy candidate or mix version namespaces. New changes require extending/reviewing the checked manifest and installation history model. The readiness inspector recognizes only the complete canonical journal with matching source markers; missing, altered, partial, original-collision or unrecognized history stays blocked. Catalog inspection also explicitly rejects missing/non-text/nullable applications.visibility, addressing the shared Dashboard/Applications failure condition. Catalog/history checks still do not constitute enterprise release approval.

## Before executing any hosted SQL

1. Confirm the target and every application/collaborator using it; authorize a maintenance window and pause all known writers/workers. An unknown consumer is an unresolved dependency, not proof the database is unused.
2. Complete the private backup/export and recovery procedure in DATABASE_PREFLIGHT_20261101.md. Include Auth and role/grant state, configuration and object data as applicable. Do not reset the existing DB password to obtain access. A Windows pg_dump --version output is only a prerequisite; an archive listing is not restore proof. Keep all backups outside the repository/chat/CI.
3. Rehearse restore, record preservation comparisons and a recovery duration. Existing synthetic CI restores do not prove hosted recovery. Establish the expected maintenance window from measured backup/install/Auth/PostgREST acceptance and a recovery buffer; hosted downtime is currently unmeasured.
4. Review the exact generated SQL, canonical mapping, target identity and preservation impacts. Obtain execution approval for that exact target. No approval for a disposable test or package generation authorizes hosted execution.
5. Execute the reviewed install.sql with psql -X --set ON_ERROR_STOP=on --file PATH using privately configured connection credentials. Do not add --single-transaction: the package already has its own transaction. Do not paste a credential-bearing connection string into chat or shell history. Do not execute the file through tooling that splits/commits individual statements.
6. Validate history/catalog read-only, then real staged/approved identity login, PostgREST RPCs, browser-role denial, tenant isolation, customer terms, product access, Projects persistence, mobile sidebar and logout. The existing /api/health is explicitly connectivity-only, not a release-readiness check. Fresh targets require a separately approved initial administrator identity/profile; never auto-promote the first signup or run demo seeds.
7. Release the backend only after these gates pass. Keep the maintenance window until the correct backend and database pairing is confirmed. Legacy invited memberships remain invited; their recovery/reissue is a separate identity action.

## Failure and rollback

On SQL failure, stop, roll back/close the failed transaction and retain private error evidence. The installer does not catch errors to continue. Never rerun after an uncertain commit: inspect history and objects first. Before successful commit, transaction rollback preserves the prior schema/data; acceptance tests inject a late error to verify that behavior. After commit, use a reviewed forward repair, or a separately approved recovery through the tested backup procedure after reconciling post-backup writes. Never drop feature tables or reset the hosted database as a rollback shortcut.

See MANUAL_QA.md for the full portal/customer/project/integration/security acceptance workflow. Remaining enterprise gaps are tracked in docs/roadmap/PROGRESS.md; this handoff does not claim MFA, hosted disaster recovery, monitoring, live integrations or production release readiness.
