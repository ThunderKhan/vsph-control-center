# Read-only diagnosis of partial canonical migration history

The original installer deliberately aliases two historical Music files sharing `20261030`, preserving their immutable source checksums. A target journal therefore uses canonical baseline `20261030000000` and distinct Music versions `20261030000100` / `20261030000200`.

Previously, `assess()` selected that canonical namespace only when every current source migration was installed with a matching marker. Adding a new source migration made a valid older canonical ledger fall back to the raw historical versions, reporting spurious Music collisions and an unrecognized baseline. That was a diagnostic bug, not proof the installed target needed bootstrap/reconciliation again.

## Current behavior and denial rules

- Recognize a canonical namespace from its explicit baseline version/name, even when forward entries are missing or a missing version sorts below a later installed entry.
- Compare every present version/name/source marker to the source manifest. Unknown identities, duplicate versions and marker drift remain blockers.
- Report only missing canonical identities as pending. A mismatched marker is drift requiring review, not an instruction to replay that migration.
- `canonicalHistoryRecognized` identifies the known journal format; it is not checksum or release verification. `canonicalHistoryVerified` requires all current entries and matching markers.
- Incomplete/drifted history keeps `historyReconciled=false`; `releaseReady` remains false even with complete history. Catalog grants/RLS, real Auth/PostgREST, backup/recovery and operational acceptance are separate gates.
- Inspection runs read-only, with bounded queries/timeouts. It never writes or silently repairs history and never applies SQL.

The existing `staging:inspect` target/TLS/explicit-isolated-approval guards are unchanged. This feature does not designate the potentially live development candidate as staging or authorize use of that CLI against it.

## Latest metadata evidence and operator boundary

A read-only Supabase `list_migrations` call on 3 November 2026 reported 19 canonical entries through internal employees. This is version/name evidence only: no source markers, function/catalog equivalence or user data were read. It supersedes the earlier eight-pending source-report cutoff. A subsequent source-only account-consent increment adds a fourth gap; these four identities are missing by that last recorded ledger:

1. `20261103072229_project_work_search.sql`
2. `20261103155930_internal_hr_lock_order.sql`
3. `20261103165522_internal_employee_identity_links.sql`
4. `20261103170000_finance_ledger.sql`

The search gap sorts before installed employee governance. Preserve its merged version/checksum. Before separately approved target writes, compare existing canonical source markers and catalog, verify backups/recovery, prepare only the reviewed forward SQL/history entries in the canonical workspace, inspect impact and validate the resulting target. Do not rerun bootstrap/seeds/legacy installer or blanket-push the original duplicate-Music-version folder. This diagnostic change installs nothing and does not change the user's Free plan, credentials, Auth settings or records.

## Verification

Node tests model the 19-entry canonical subset with the three real source gaps, then reject tampered markers, duplicate versions, renamed entries and unknown migrations. Native PostgreSQL tests create only a synthetic private ledger in the already empty loopback fixture, run the actual read-only inspector, verify exact pending rows and no history mutation, inject drift and confirm denial, then remove that synthetic namespace. The existing fixture/database guards and all CI security/restore/browser checks remain required.
