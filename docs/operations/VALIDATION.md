# Validation, staging and governance

Use Node 20.19+ (CI uses latest Node 20). `npm ci`, `npm test`, `npm run check`, `npm run lint`, `npm run format:check`, `npm run test:coverage`. Vanilla JS has no TypeScript compilation or bundling step; syntax + ESLint cover parsing, not static types. Do not invent typecheck/build scripts.

Browser: `npx playwright install chromium`, `npm run test:e2e`. Desktop and mobile Chromium run public login, protected redirects and invite landing. These tests intentionally have no Auth credentials. Authenticated sidebar/onboarding/SSO tests still require staging fixtures. Reports in playwright-report and traces on failure; never record real customer sessions.

Database: ordinary non-root OS user runs `npm run test:db:local` for a fresh disposable native Postgres cluster. No Docker/cloud keys required. It creates a database named vsph_test and removes the temporary cluster afterward. Root environments must supply an isolated loopback Postgres instance; helper never creates OS users. Alternatively set TEST_DATABASE_URL to an EMPTY loopback database named vsph_test and run `npm run test:db`. It fails if configured remotely or already populated. Test SQL creates stub auth.users and nonlogin roles, applies bootstrap then historical migrations, tests RLS/privileges/FKs/cascades/concurrent code consumption. This is database proof, not real Supabase Auth/SMTP proof.

CI gates: Node regression/syntax/lint/format/coverage, production dependency audit, isolated PostgreSQL 17 schema tests, Chromium desktop/mobile. Integration jobs use no repository secrets or customer data. Review artifacts for failures. Existing broad source checks are retained but not credited as end-to-end proof.

## Migration staging gate

Do not run bootstrap SQL on existing customer data. Historical sequence: supabase/schema.sql (new empty project only), 20261030_music_sso_launch_codes.sql, 20261030_music_staff_musician_roles.sql. M2 must reconcile these with actual Supabase migration history before introducing a CLI baseline. No supabase db reset/link/push command is approved for production. Obtain staging project access, inspect history/catalog, backup, rehearse an upgrade with populated synthetic fixtures, then review SQL diff. Record versions and checksums; production requires a separate release approval. No migrations were applied to hosted staging or production in M0.

## GitHub settings (maintainer action)

Connector lacks administration permission (branch-protection API 403). For main, enable protection/ruleset: require PR, dismiss stale approvals, require resolved conversations, prevent force-push/deletion, require up-to-date branch and checks named `Node quality`, `PostgreSQL isolation`, `Browser smoke`, `Production dependency audit`. Require human approval if organizational policy calls for it; never bypass it. Confirm check names after first successful run. GitHub metadata initially reports protected=false and rulesets=[].

## Configuration and release

Copy .env.example locally and enter approved staging Supabase values. `npm run dev` serves port 3000. Without keys, login HTML boots but authenticated operations and readiness return unavailable. Do not seed real projects. Supabase exact /accept-invite allowlist and staged SMTP proof are still missing. Music hostname source binding returns 404 in connected team; do not enable its SSO variables.
