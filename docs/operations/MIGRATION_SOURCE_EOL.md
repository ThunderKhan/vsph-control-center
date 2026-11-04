# Canonical migration line endings

Migration SHA-256 values describe exact LF source bytes. The repository previously had no line-ending policy, so a Windows-style `core.autocrlf=true` checkout could turn reviewed SQL into CRLF and fail byte checks without changing visible SQL. This failure mode was reproduced with real Git in an isolated temporary repository; the user's Windows configuration was not inspected and no claim is made that their files actually had CRLF.

`.gitattributes` now pins `supabase/schema.sql` and `supabase/migrations/*.sql` to LF. It does not change the user's Git configuration or alter stored historical migration/checksum values. Existing worktrees can retain older CRLF bytes even after this policy is pulled.

## Inspect and repair source only

```powershell
npm run migrations:eol
npm run migrations:eol -- --write
npm run check:migrations
```

The first command is read-only and returns nonzero if normalization is needed. `--write` changes CRLF to LF **only when the normalized bytes exactly match the reviewed manifest SHA-256**. It inspects every manifest entry before writing anything. If any file contains actual SQL edits, invalid paths/checksums or unsafe symlinks, it refuses rather than discarding work or recomputing accepted hashes. It checks again for concurrent changes before each planned write. A race can stop after earlier safe normalizations; review the working tree before retrying. UTF-8 source is retained, and repeated successful normalization is a no-op.

The output explicitly says `scope=repository-source-only` and `databaseModified=false`. No database connection, migration installation, history repair, reset, seed, credentials, provider or cloud operation occurs. It touches only the registered schema/migration source paths. Unregistered/new developer SQL still needs normal manifest review; this helper does not approve it. Never replace a genuine checksum/content error with a freshly computed manifest hash merely to make checks green.

CI runs the read-only check before Node acceptance. The regression test simulates CRLF, proves inspection does not write, refuses a genuine edit before any write, verifies UTF-8/exact digests/idempotency/path rejection, and checks out SQL under real Git `core.autocrlf=true` with the repository attributes. This is cross-platform source/Git evidence, not native Windows database acceptance. Use the complete [Windows handoff](WINDOWS_HANDOFF.md), [migration plan](PARTIAL_MIGRATION_HISTORY.md) and [database installation boundary](DEPLOYMENT_HANDOFF.md).
