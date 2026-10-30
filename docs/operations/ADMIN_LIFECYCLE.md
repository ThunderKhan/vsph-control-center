# Retired password provisioning — M1 increment

Authorization boundary: platform routes still require an active portal session and platform super_admin. Regular users, invited users, tenant owners/admins and product staff/musicians do not gain platform administration through their scoped roles.

POST /api/admin-management/users and POST /api/admin-management/clients now return 410 with a successor link, even for platform administrators. They never invoke Auth or database writes. Staff cannot choose passwords, auto-confirm identities, or elevate platform roles through these endpoints. The UI removes the corresponding password/role form and points to existing customer email onboarding. No replacement standalone-user capability is claimed; M3 must supply governed invitations for existing tenants/users.

User status changes refuse self-disable and any platform administrator lifecycle change. Read and write predicates protect against a role changing between validation and mutation. This closes concurrent administrators disabling each other via this endpoint without pretending to implement the missing atomic, MFA-governed administrator recovery process. Existing out-of-band database/Auth operators remain responsible for approved recovery.

Existing ordinary-user status mutation/audit are separate writes and still require M2 atomic audit semantics. Disabled profiles are denied on the next portal request, but enabling a disabled profile can reactivate an unexpired session; durable revoke-on-disable is still pending M1/M3. No completeness claim.

Tests: real Express handler/authorization tests with isolated Auth/DB substitutes prove retired paths make zero calls, scoped roles receive 403, self-disable is denied, and another platform admin cannot be disabled. CI native DB tests cover existing constraints; staged Auth lifecycle UAT is still blocked.

Migration: none. Rollback: reverting reintroduces the retired unsafe paths; prefer a forward fix. Deployment not performed. Staging manual QA: customer onboarding invitation flow, user listing, status changes for ordinary users, 410 legacy APIs, no password/role controls in admin UI, and existing navigation at desktop/mobile. Screenshots require authenticated synthetic staging; unavailable in this session, not fabricated.
