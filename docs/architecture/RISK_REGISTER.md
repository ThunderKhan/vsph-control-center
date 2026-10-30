# Risk register

All remain open until verified evidence closes them. Severity indicates release impact, not a demonstrated exploit.

| ID  | Severity | Evidence                                         | Remediation / owner gate                                                   |
| --- | -------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| R1  | P0       | security.js / privileged db.js                   | Scoped authorization, real DB + HTTP cross-tenant matrix (M1)              |
| R2  | P0       | admin-management POST users/clients              | Remove staff passwords/elevation; governed invitations (M1/M3)             |
| R3  | P0       | onboarding.js external Auth then REST            | Idempotent provisioning workflow, atomic DB + outbox (M2)                  |
| R4  | P0       | invitations.js getUser + all pending memberships | Durable invite purpose, expiry, revoke, concurrency (M2/M3)                |
| R5  | P0       | separate mutation then audit writes              | Atomic mutation/audit and external reconciliation (M1/M2)                  |
| R6  | P0       | no credential/staging connection                 | Apply/verify migration history and staging restore; operator access needed |
| R7  | P1       | server.js trust proxy=1; auth routes             | Explicit proxy policy, throttles, headers, safe logs (M1/M11)              |
| R8  | P0       | no Music project in connected Vercel team        | Establish source binding, server authorization, persistent backend (M6)    |
| R9  | P1       | main unprotected; administration API 403         | Maintainer enables checks/review rules without bypass (M0)                 |
| R10 | P1       | absent project tables/routes                     | First-class private portfolio with isolated assignments (M7)               |
| R11 | P1       | admin full-table queries                         | Cursor pagination, bounded filters (M2/M4)                                 |
| R12 | P0       | no verified backups/MFA/SMTP                     | Staging operational exercise and identity governance (M3/M11/M12)          |

Neither absent staging proof nor mocked success counts as remediation. No customer deployment or production DB mutation is authorized by a test result.
