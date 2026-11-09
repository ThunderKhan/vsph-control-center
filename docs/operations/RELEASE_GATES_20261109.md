# Four operational release gates — November 9, 2026

## Verified target and non-destructive boundaries

Source: ThunderKhan/vsph-control-center, current green main commit. Database: existing Supabase vsph-supabase (zbmerhexucqxazuxjmmw), PostgreSQL 17.11, **Free** tier. Forty-four canonical migrations match, and the preceding install verified unchanged fingerprints for fourteen existing tables. Never reset users, replay migrations, install demo seeds or overwrite an existing customer organization.

The connected Vercel project named vsph is a separate Next.js project. It is **not** a verified deployment of this Express Control Center. The new production container and read-only HTTP smoke tests are checked independently in CI.

## 1. Invitation delivery — provider connection required

- The existing invitation worker uses a durable SQL outbox, leasing, encrypted payload, token hashing and a stable provider idempotency key. The web server does **not** automatically send email.
- The live database currently has **one queued invitation with zero delivery attempts**, no encrypted delivery payload and no delivered timestamp. This is not a sent invitation.
- In the operator's **private deployment environment**, configure verified PUBLIC_ORIGIN (HTTPS), INVITATION_DELIVERY_ENABLED=true, approved HTTPS INVITATION_DELIVERY_URL, approved provider INVITATION_DELIVERY_SECRET and a persistent private INVITATION_OUTBOX_KEY (32-byte hex).
- First verify the actual intended sender and recipient, then run one deliberate batch with npm run invitations:dispatch. Only start WORKER_JOBS=notifications,invitations npm run workers after the sender, recipient, provider idempotency and recovery process have been approved. Operate workers separately from the web process with restart/alerting.
- Confirm delivery with the real recipient and complete acceptance. An adapter HTTP 2xx is provider submission acceptance, not proof an email reached the mailbox. Check tenant/product permissions and revoke/expired-link denial.
- Never bypass the outbox by manually emailing a capability URL or marking the invitation delivered in SQL.

## 2. Real Supabase Auth and owner/HR/employee/customer testing

- The database has 12 Auth users, one active platform owner, three active employees and three linked employee identities. At inspection time **none had a current portal session**; existing Supabase Auth session rows do not establish successful VSPH portal login.
- Hosted SQL verifies that the sensitive project, HR and invitation RPCs grant only service-role execution and protected tables deny browser SELECT. An unrelated customer is denied the existing project's workforce and custom-app read.
- Real credential-based sign-in has **not** been performed. It requires the existing operator-controlled private Auth credentials and the real running portal. The repository already provides a controlled setup for operator-owned accounts:

```powershell
npm run config:inspect -- zbmerhexucqxazuxjmmw
npm run accounts:setup -- --project-ref zbmerhexucqxazuxjmmw
npm run dev
```

- Account setup may create controlled test identities; review the existing live state before invoking. It prompts privately for owner password/TOTP, stores test credentials outside the repository and must not be run against an unintended database.
- Verify through real sign-ins: owner can govern managers/clients; HR cannot appoint HR/managers; employee sees only own work; customer is denied HR, finance, other tenants and non-shared projects. Verify disabled/revoked sessions, invitation acceptance and sign-out.
- Keep test credentials and session cookies out of chat, GitHub, CI logs, screenshots and artifacts.

## 3. Hosted backup and restore — Free project requires manual export

- Supabase Free has **no automatically scheduled daily backups**. Official documents: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- An operator with existing database access must create a private timestamped export of database roles, schema, data and migration history. Preserve relevant Auth, VSPH customer, employee, subscription, Finance and project records. Store encrypted off-device and outside the repo/chat; storage files require a separate backup.
- Verify dump checksums and listing, then restore into a **separate approved disposable Supabase-compatible environment**. Compare record inventories, fingerprints, migrations, grants, RLS, indexes, constraints, triggers and sequence state; measure recovery duration.
- Do not rehearse by restoring or resetting the connected live project. No paid Supabase project or branch was created. Source CI already performs real pg_dump/pg_restore against an **isolated synthetic** PostgreSQL service, which is not proof that hosted data can be restored.
- A successful private restore receipt (checksum, restore target, preservation checks and measured recovery time) is needed to mark this gate passed.

## 4. Deploy and verify the real Control Center backend

- The committed Dockerfile packages Node 24 Express under a non-root account; .dockerignore excludes private environment files and archives. CI runs a no-secrets container build and proves the login page starts while database health fails closed and protected routes reject unauthorized requests.
- Use a **dedicated controlled Node web service** to host this Express app. Do not overwrite the unrelated Vercel vsph Next.js project. The target and its domain must be approved; this session has no connected Control Center production deployment.
- Put SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, NODE_ENV=production and exact PUBLIC_ORIGIN in that environment's secret manager. Never ship server-only keys to browser assets. Independently deploy/supervise workers after enabling their actual provider configuration.
- Once a live HTTPS Control Center domain exists, run the already implemented anonymous verification command:

```powershell
npm run release:smoke -- --origin https://YOUR-CONTROL-CENTER-DOMAIN
```

- The tool checks live DB connectivity, login-page HTML and rejection/redirects on protected project, HR and onboarding endpoints. It intentionally **does not** claim real Auth, invitation, backup or deployment release readiness. Complete gates 1–3 against the same final domain before approving production use.

## Current release decision

**Implementation prepared; production acceptance blocked.** The source and DB migrations are complete, and the synthetic tests plus new container build/smoke check pass. A verified provider/sender, real credentials and role sessions, a private hosted backup and independent restore, and an approved deployed application domain are external prerequisites. Do not falsely mark any of these four gates successful until their specific acceptance evidence exists.
