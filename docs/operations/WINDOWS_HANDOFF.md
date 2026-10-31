# Windows PowerShell — Phase 3

Commands/scripts are verified in Linux Work/CI; native Windows execution was unavailable. Preserve personal changes before switching main. Use an ordinary OS account for the disposable PostgreSQL helpers.

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
npm run test:coverage
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

The full audit currently reports six moderate development-tool findings through minimatch, with no high/critical findings; production audit is clean. Do not run npm audit fix --force: its suggested tool downgrades are not validated. See RISK_REGISTER.md. No typecheck/build script exists for this vanilla JavaScript application. npm run test:e2e without DB mode runs public checks and skips authenticated fixture journeys; test:e2e:db creates a disposable native database and runs the full suite. Fixture URLs must be empty loopback vsph_test, never hosted staging/production. Root OS execution deliberately refuses privilege/account creation.

Normal server requires securely configured Supabase .env plus PUBLIC_ORIGIN=http://localhost:3000 and PORT=3000. Reconcile/install/verify missing reviewed migrations in approved isolated staging before any backend rollout. Phase 2 002/003/004 and Phase 3 005/006/007 were NOT applied hosted in these sessions. Do not bootstrap/seed an existing customer database. Refer to PHASE3_MIGRATIONS.md for order/backup/UAT gates.

## Project and engineering acceptance

1. Sign in at http://localhost:3000/login with an existing platform administrator. Open Projects, create internal/customer work, assign existing members/team roles, milestones and tasks, update statuses, add comments/evidence, reload and inspect progress/history.
2. An operator first registers/installs an approved GitHub App with Metadata/Contents/Pull requests/Actions/Checks READ and configures server-only GITHUB_INTEGRATION_ENABLED, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY. Optional signed webhook needs GITHUB_WEBHOOK_SECRET and approved HTTPS endpoint. These credentials/installation are not provisioned by the code or tests.
3. Engineering → platform administrator verifies installation ID for the project → manager discovers/selects an authorized repository → connect. Synchronize next page advances one durable category/page. Inspect real source links, PR/build/release state, source versus observation time, checkpoint/error/retry time. Link a PR/release explicitly to a task or milestone and reload. Disconnect and confirm private facts/links disappear. Test unrelated/client/revoked accounts separately.
4. Projects → Project inbox and reports: assignment/milestone/engineering notices, mark read, preferences and failed-delivery recovery. Filter reports by project/customer/owner/status/creation date; reconcile counts with persisted source work. Requested reviews do not mean approval. Retained failures do not mean latest branch failure. Vercel remains visibly unconfigured.
5. Projects → Your active sessions: review safe session timestamps, revoke one other session or all others, confirm linked product sessions end and the current portal stays active. No device or MFA claim is made.

After approved staging setup only, an operator/scheduler can invoke these finite server-owned batches:

```powershell
npm run github:sync
npm run notifications:dispatch
```

They persist sync/notification state in the configured database. They were not run against hosted customer databases in this execution. github:sync refuses disabled/incomplete App configuration. No hidden worker or background continuation is started by npm run dev. Do not run invitations:dispatch against real recipients as a development step; invitation provider remains off/unverified. Music SSO remains separately gated. Full manual cases are in MANUAL_QA.md, GITHUB_DELIVERY.md and ACCOUNT_SESSIONS.md.
