# Windows PowerShell handoff

Use Node 20.19+; the commands/scripts below were executed in this Linux Work runtime or GitHub CI. Windows PowerShell itself was not available, so native Windows execution is not claimed. Confirm a clean working tree before switching; preserve any personal edits. Git shell authentication is configured on your machine independently of the connected GitHub tools used here.

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
npm run test:e2e
npm run test:db:local
npm run dev
```

The helper's root refusal was exercised here; ordinary Windows execution remains unverified. Run the disposable database helper as an ordinary OS user; it downloads native PostgreSQL binaries through npm and never uses SUPABASE_* values. Native PostgreSQL 17 CI tests have passed; this Work host cannot drop root privileges. If using your own empty isolated database, set TEST_DATABASE_URL to loopback /vsph_test and use npm run test:db. It refuses remote/populated targets. Do not point it at staging or production.

There is no npm run typecheck or build script: this is vanilla JavaScript/HTML and Express. Lint is a focused correctness rule set, format:check covers architecture/operations/roadmap Markdown, and coverage is a report rather than a blanket correctness claim.

Runtime needs an existing .env with approved SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, PUBLIC_ORIGIN=http://localhost:3000 and PORT=3000. Keep secrets out of chat/Git. If no .env exists, copy .env.example and configure it through your normal secure workflow. The login/invite-help pages boot without Supabase, but authenticated login/data and /api/health readiness do not work without configuration.

Before deploying the new account-status API, reconcile hosted history and apply reviewed 20261031000100_atomic_profile_status.sql in isolated staging. It has not been applied to hosted projects here. No production seed, migration or release approval is implied by these commands. Do not run npm run seed on customer databases.

Verified unconfigured behavior: /login=200; /accept-invite=200; anonymous /dashboard, /applications, /admin and /admin/onboarding redirect to /login; /projects=404 because M7 is not built; /api/health=503 without keys. A working public Music URL is not verified portal SSO. Test the configured workflows using MANUAL_QA.md before release.
