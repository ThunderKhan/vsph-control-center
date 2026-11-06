# Background processing for company operations

## What runs

The separate `npm run workers` process continuously scans overdue work and dispatches in-app project notifications through the existing durable SQL outbox. It does not start implicitly with the web server and does not send email by default. Run it alongside `npm run dev` locally, or under an operator-managed process supervisor for company operation. `npm run workers -- --once` runs one finite batch per selected job for an external scheduler and exits nonzero on failure.

`WORKER_JOBS` selects unique comma-separated names. Default: `notifications`. Other supported names are `github` and `invitations`; no script path, shell command or arbitrary arguments can come from this setting. All requested providers are validated before any job starts. GitHub requires the existing enabled configured GitHub App. Invitations additionally require explicit `INVITATION_DELIVERY_ENABLED=true`, the approved HTTPS delivery adapter/secret, a 32-byte hex encryption key and a trusted portal origin. Do not enable invitation delivery without verifying the sender, recipient and adapter idempotency contract. This worker does not email employee temporary passwords; private employee handoff remains separate.

| Job           | Normal cadence after batch completes | Batch bound                                       | Ownership                                                             |
| ------------- | ------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| notifications | 60 seconds                           | Existing SQL scan limits and 50 queued deliveries | Server-only command; SQL rechecks recipient/project/preferences       |
| github        | 60 seconds                           | At most 14 claimed synchronization pages          | Existing current connection/installation/lease authorization          |
| invitations   | 10 seconds                           | One durable outbox claim                          | Existing invitation generation, lease, encryption and identity checks |

The scheduler has one in-flight batch per selected job per process. Different jobs run independently so a failed provider does not stall reminders. Failed batches back off exponentially with jitter, capped at 30 minutes; a success resets the delay. Database outboxes/checkpoints, not process memory, preserve work across restarts. Multiple processes rely on the existing SQL claims/unique constraints; external email delivery is at-least-once and requires the adapter to honor its stable idempotency key. No exactly-once provider claim is made.

## Limits and shutdown

Each batch runs in an isolated Node child without a shell. Standard output/error from children is discarded; supervisor events include only job name, running/status, timestamps, failure count and next delay. Never add provider error bodies, identities, URLs, tokens or payloads to these events. GitHub batches now fail nonzero when a claimed provider page reports an error, rather than falsely reporting scheduler success. The finite notification command reports completion only after scan and dispatch succeed.

A batch is limited to five minutes. Timeout sends SIGTERM and, after five seconds, SIGKILL if needed. Ctrl+C/SIGTERM interrupts waiting and terminates/drains active children without scheduling more work. Termination can interrupt an external operation: consult durable recovery views before retrying uncertain invitation work; do not reset leases/users or manufacture success. Child-close confirmation precedes scheduler retry. Windows uses Node's process termination semantics; this session tests real processes on Linux, not native Windows service installation.

Events are current-process health, not a durable monitoring database, queue-depth metric or proof that all records are processed. `ok` means the finite batch completed, not that every connection is healthy. SQL may suppress unauthorized events or quarantine delivery failures; inspect application recovery/connection views. Operators must collect events, alert on sustained failures/no progress, restart crashed processes and schedule an incident/restore exercise. `/api/health` still reports database connectivity only; it does not certify worker health or release readiness.

## Windows local operation

Keep the web server in the first PowerShell terminal. In a second terminal:

```powershell
cd D:\Projects\vsph-control-center
npm run workers
```

This uses the same configured database as the portal and performs real notification work. Do not run it against an unintended environment. Notifications only need the existing database configuration; no Docker, SMTP or paid cloud service is needed. To run a deliberate single batch instead:

```powershell
npm run workers -- --once
```

To opt into verified GitHub polling, set `$env:WORKER_JOBS = 'notifications,github'` in the worker terminal after the GitHub App installation is authorized/configured. Do not add `invitations` for a UI demonstration. Clear a session override using `Remove-Item Env:WORKER_JOBS -ErrorAction SilentlyContinue`.

## Acceptance, migration and rollback

No migration, dependency update, credential/provider setting, cloud resource or hosted write is performed by implementing this runner. Starting it later explicitly performs the selected existing workflows. Native PostgreSQL acceptance executes the exact notification batch with competing invocations, duplicate suppression and revoked-membership inbox denial. Node tests run real subprocess success/failure/timeout/stop and test scheduler nonoverlap, exponential recovery, explicit configuration and secret-free events. Existing browser acceptance remains required before merge; a mock provider does not establish live email/GitHub behavior.

Manual acceptance: assign work to an authorized employee; run the notification worker; verify their notice and preferences; revoke membership and verify it disappears; stop/restart the worker and check no duplicate notice. Simulate a provider failure only in an isolated environment and observe bounded failure/backoff, recovery and continued independent notifications. During shutdown check no orphan worker child remains. Reverting source requires stopping this process first and retaining existing durable queue/schema data. Do not reset or seed the database to stop background work.
