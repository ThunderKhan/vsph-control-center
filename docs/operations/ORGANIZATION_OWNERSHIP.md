# Governed organization-owner transfer

The My organizations workspace offers a reviewed transfer from the sole active owner to an already accepted, active organization administrator. Administrators, ordinary members, invited/suspended/disabled identities, unrelated tenants and unassigned platform administrators cannot perform it. Multiple existing owners require separate platform review rather than silently choosing one. This does not promote a platform account or grant a product/project role.

## Workflow and authorization

1. The owner selects an eligible administrator from the current members page and reviews the target name/email and impact. The server/database returns the current organization and both membership versions.
2. The owner explicitly acknowledges becoming an administrator, then verifies their own password and enrolled TOTP when required. The same server-owned verifier used by portal sign-in checks the exact signed-in identity. The browser cannot supply another actor, assurance claim, provider timestamp or token hash.
3. The server mints a random authorization capability. Only its SHA-256 digest is persisted. The grant is bound to the current unexpired portal session, actor, organization, target and all three reviewed versions. It expires after at most two minutes (or the portal session expiry, whichever comes first). A new grant revokes previous unconsumed grants for the same actor/session/organization.
4. The browser immediately submits that capability in X-VSPH-Step-Up, without storing it in localStorage or a URL. The database rechecks all current permissions/versions and consumes the grant atomically with the membership updates, organization version increment, tenant product-session/launch-code invalidation and audit event. Exactly one concurrent transfer can succeed. Expired, revoked, different-session/target/organization or replayed proofs cannot authorize another change.

The new owner remains subject to explicit product grants/roles and independent project memberships. Existing product role assignments, subscriptions, project assignments, users and customer records are preserved. The previous owner becomes an active administrator, rather than being deleted or losing unrelated organization memberships. Audit events record actor/target/assurance and versions, never passwords, OTPs, raw proof or provider tokens.

All profile locks use consistent platform-first/UUID ordering before session, organization, membership and grant locks. The organization lock serializes transfers with existing customer lifecycle/member governance. Fresh authorization and expiration use the database wall clock after lock waits. Audit failure rolls back proof consumption and all ownership/session mutations. If an HTTP response is lost, refresh and inspect the current owner/history rather than blindly retrying a stale transfer.

## Migration and retention

`20261103062727_organization_owner_transfer.sql` follows `20261103053129_delegated_invitation_profile_locks.sql`. It adds the private RLS-enabled organization_owner_transfer_grants table, indexes and service-role-only organization_ownership function with a fixed empty search path. Browser table/RPC privileges are denied. The server-only authorize operation trusts only the verified credential service's timestamp/assurance; its HTTP route rejects those fields from callers.

Deleting/revoking the bound portal session cascades its transient grants. Each issuance removes at most 1,000 expired grants for that actor; expired records cannot authorize even if retained. Revoked/consumed records expire naturally and are cleaned on later issuance or session removal. Audit retention is independent and unchanged. No production data was used to test this cleanup.

This is a **fourth unapplied forward migration** after the three previous customer-self-service additions. No hosted migration, Auth enrollment, credential change, email, hosting or paid resource is part of this continuation. Do not rerun bootstrap, seeds or the legacy installer on the existing database. Normal runtime needs the reviewed function/table installed in its target; disposable PostgreSQL/Chromium helpers install the source in isolated fixtures.

## Acceptance and repair

Native PostgreSQL tests cover hierarchy/tenant/state denial, multiple-owner rejection, fresh authentication time, exact scope/session/version binding, proof rotation/expiry/replay, session revocation, audit rollback, concurrent transfer, preserved product roles and browser privilege denial. Database-backed HTTP tests run the actual password/TOTP credential flow with an explicit provider substitute; forged verification fields never mint a grant. Desktop/mobile Chromium exercise review, wrong password, required TOTP, persistence and sign-in by the new owner. These fixtures do not establish live Supabase Auth acceptance.

Rollback by removing the new UI/routes and forward-repairing the function, retaining membership/audit data. Do not automatically transfer ownership back or restore old sessions as a down migration. Lost-owner access, owner replacement without current credentials, broad platform administrator recovery and MFA enrollment/recovery still need separately governed workflows. This step-up protects the new customer-owner transfer path specifically. Existing higher-trust platform customer-governance permissions remain separate; this is not yet a universal gate for all sensitive administration.
