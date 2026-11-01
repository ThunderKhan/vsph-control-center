# Disposable PostgreSQL backup/restore rehearsal

CI reuses only its isolated postgres:17 service after the native fixture suite. test:restore:ci refuses every target except an explicitly enabled CI service, loopback PostgreSQL port 5432/database vsph_test/user postgres, no connection overrides, and an explicit 64-character container ID whose image is postgres:17. It never reads staging/production variables.

It snapshots aggregate row counts/content digests, constraints, sequence state and the security catalog; runs the matching container's pg_dump in custom format; creates a separate vsph_restore database; restores with pg_restore --exit-on-error; and compares all snapshots. Dump files have private permissions and are removed afterward, never printed or uploaded. The clone remains until the disposable CI container is destroyed. An existing clone is refused rather than overwritten. No drop/reset/seed of a hosted database is supported.

This is a real native PostgreSQL logical backup/restore rehearsal over synthetic fixture records. It is not a backup of hosted customer data, a hosted restore, Auth service restoration, production disaster recovery or an RPO/RTO/SLA claim. The final CI result is required before reporting restoreVerified. Failure reports omit credentials and dump contents. Hosted restore planning still requires actual project/history/backup access and separate approval.

The staging inspector also rejects connection query overrides: an approved URL hostname cannot be replaced by a driver-specific host query parameter. Remote inspection continues to require sslmode=verify-full. The plaintext advisors connection is confined to the isolated loopback CI Docker service; it does not change hosted TLS policy.

PR #31 passed native CI after normalizing unordered catalog rows: 35 tables, 176 constraints, four sequences and eight application RPCs matched. Initial comparison failure was not merged. Hosted recovery remains unverified.

Phase 4 also compares public index definitions and non-internal security trigger definitions/enabled state. Native accepted restore matched 36 tables, 186 constraints, 75 indexes, four triggers, four sequences and 12 application functions after new governance/lifecycle migrations. The controlled binding/suspension lock-gate and duplicate-migration rollback/repair are synthetic fixtures, not hosted operations.
