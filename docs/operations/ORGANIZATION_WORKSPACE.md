# Customer organization workspace

The `/organizations` page and `/api/organizations` endpoints are a distinct customer-administration boundary. The dashboard navigation links to My organizations. An active owner/admin membership in an active organization is required; platform administration, product roles and project assignments do not confer this permission. Ordinary members see an empty directory and cannot read the administrative workspace. No external hosting or provider is needed to exercise the implementation in the isolated fixtures.

## Delivered workflow

Owners and administrators can read their organization, real membership counts, assigned product access and subscription terms. They can edit its display name with an organization-version precondition. Slugs, lifecycle, subscription terms, platform identities and billing remain platform-owned. There are no revenue metrics or payment claims.

Owners can change administrator/member/viewer memberships. Administrators can manage member/viewer memberships only. Neither can change themselves, an owner or a platform account. Pending invitations cannot be activated through membership editing. Explicit account disable cannot be undone. Suspension invalidates pending enrollment and removes tenant product sessions/launch codes without deleting users, roles, customer records or project assignments. Reactivation does not restore sessions or expand permissions.

Product-role changes require the actor's own explicit admin/super_admin role for that product and an effective organization entitlement, alongside organization administration. No implicit product role is granted. Assignment/removal of product super_admin remains platform-owned. The target must be an active member; a product-specific role must exist. An expired/future subscription or suspended grant cannot be used to assign access. Product/session middleware continues rechecking current permissions independently.

All mutations use the server-derived actor, database-side fresh authorization, allowlisted inputs, optimistic versions and an audit row in one transaction. Actor/target profiles use a consistent order across organizations (platform actors first, then UUID order), before the organization and memberships. Scoped authority is rechecked under those locks. The organization lock serializes delegated edits with platform membership/lifecycle changes. Audit failure rolls back the mutation. Access-changing UI operations require confirmation, and conflicts require reload and review.

The directory uses UUID keyset pages of 100 organizations and 50 members. Product summaries explicitly disclose the first-100 limit. Recent activity includes only the latest 50 `organization.*` events, without raw audit details, other-tenant records, invitation capabilities or provider credentials. This is not a complete platform audit export.

## Migration and operational boundary

`20261103050509_organization_workspace.sql` follows `20261101054139_customer_lifecycle.sql`. It adds only a service-role-only function, with a fixed empty search path; it adds no browser grants, tables, seeds or external side effects. Existing migrations/checksums are unchanged. The checksummed manifest, installer, native upgrade/restore acceptance and browser fixtures include the new function.

This new migration is **unapplied to the hosted database**. Hosting/deployment is intentionally outside this continuation. Install the reviewed forward migration before releasing the new page/API; do not rerun bootstrap or the historical legacy installer on the existing target. Revert the new routes/navigation/UI if rollback is necessary, retain the audit history, and forward-repair the function. Older application functionality does not depend on this added function.

## Acceptance

Native PostgreSQL coverage checks regular/viewer/invited/disabled/anonymous/expired-session denial, unrelated tenant and unassigned platform-admin denial, explicit product-role authority, expired entitlement, privilege escalation, stale/concurrent edits, session removal, fresh revocation checks, browser execution denial and transactional audit failure. Authenticated Chromium exercises real fixture-backed name, membership and product-role updates, reload persistence, activity, narrow layouts and unauthorized denial. The fixture transport is not Supabase Auth/PostgREST acceptance.

Manual: sign in with an explicitly authorized customer owner, open My organizations, review counts/products, rename the organization, change a member's product role, suspend/reactivate an ordinary member, reload and inspect history. Verify an ordinary member and an unrelated administrator cannot read/change it. Check a revoked administrator immediately loses access and a stale form conflicts. Existing platform customer administration, onboarding, Projects and application access must remain available to their respective authorized roles.

Still pending: customer-admin invitation issuance/renewal/cancellation, broader organization profile fields, subscription communications, governed owner transfer, MFA/step-up and administrator recovery. Invitations remain available to platform administrators through the existing secure workflow; no customer password or activation shortcut is introduced.
