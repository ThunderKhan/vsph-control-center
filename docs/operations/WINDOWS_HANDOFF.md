# Windows PowerShell — Phase 2

Commands/scripts are verified in Linux Work/CI. Native Windows execution was not available; do not read this as Windows certification. Preserve personal changes before switching main.

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
npx playwright install chromium
npm run test:db:local
npm run test:e2e:db
npm run dev
```

Use an ordinary OS user for disposable native PostgreSQL helpers. Root Work execution deliberately refuses privilege/account creation. Native PostgreSQL 17 plus authenticated Chromium evidence comes from CI. npm run test:e2e without DB mode runs public smoke and skips project acceptance; npm run test:e2e:db creates a temporary empty vsph_test cluster and runs all authenticated/public cases. Tests create synthetic SQL identities/sessions and never call real Auth/SMTP. Do not set fixture TEST_DATABASE_URL to hosted staging/production; remote/populated fixtures are refused. No typecheck/build script is invented for this vanilla JavaScript app.

Normal server: retain your securely configured Supabase .env, PUBLIC_ORIGIN=http://localhost:3000 and PORT=3000. Before deploying/running new backend functionality against a hosted target, reconcile history and install/verify reviewed migrations 20261031000200_durable_provisioning.sql, 20261031000300_projects.sql and 20261031000400_invitation_disable_revocation.sql in approved staging. They were NOT applied to hosted databases in this execution. Do not run bootstrap or seed on existing customer data.

After migrated staging setup: sign into http://localhost:3000/login as an existing platform administrator → Projects → New project → key/name/internal or customer organization → Create. Add an existing account by exact email under Project team, select project role and team label, then create milestone/task with assignee and due date. Move task through in_progress/in_review/done, record evidence/comment, reload, inspect progress/activity. Test contributor/viewer/client and unrelated accounts separately. Complete work/milestones before project completion; archive without deleting history. See PROJECTS_GUIDE.md and MANUAL_QA.md.

Onboarding now queues durable delivery. The invitation worker remains OFF until provider/secret configuration is separately approved. Do not execute invitations:dispatch against real recipients as part of these development commands. Actual Supabase/Auth/mailbox success remains unverified. Music SSO and other later roadmap milestones remain separate; no deployment is claimed.
