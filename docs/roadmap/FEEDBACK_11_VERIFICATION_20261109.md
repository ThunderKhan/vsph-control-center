# Verification of the eleven VSPH feedback requirements — 9 November 2026

## Scope and evidence

This audit checks the approved customer/project feedback numbered #1–#11 from `PROGRESS.md` against the `main` source, existing tests, and read-only queries to connected VSPH Supabase project `zbmerhexucqxazuxjmmw`. It does **not** claim a production web deployment or actual browser sign-in against the hosted service.

The three forward migrations for custom project apps, organization-only onboarding and workforce governance were installed in the preceding session; the target has **44 canonical migration entries**. The migration installation's preservation checks verified all 14 monitored existing data tables had unchanged fingerprints. The current audit independently reconfirmed all three RPCs and custom-app RLS are present and a customer has no access to an unrelated project.

## Requirement-by-requirement result

1. **Owner Overview footer cleanup — implemented.** Removed the unwanted owner footer notes/workflows while retaining the durable owner operations and customer metrics. Source regression: `tests/feedback-batch-20261109.test.js`.
2. **Grouped top navigation — implemented.** The shared horizontal navigation groups Work, Organizations, Applications, People and Administration with role-gated entries; owner and employee pages share the same shell. Desktop/mobile navigation regression now includes `/admin/project-managers`.
3. **Search-only entry to advanced work search — implemented.** The separate Search Work menu entry is absent; the global header search includes a direct Advanced work search link. Search results are scoped to authorized work.
4. **Customer/organization onboarding — database and UI implemented, live delivery incomplete.** Owner-only four-stage onboarding has unique slug, owner identity, optional product subscriptions or **Organization only**, review, durable idempotent provisioning/outbox and recovery. The existing database currently reports **one invitation outbox entry in `queued` state** and one invitation in `pending_delivery`; provider dispatch and customer acceptance are unverified. Do not call this fully production-complete or send real invites without a verified sender, adapter and recipient.
5. **Guided project creation — implemented.** Three-step project wizard, active authorized organization preselection, optional linked catalog products, and manager/team follow-up. The project API validates ownership and entitlement independently from URL parameters.
6. **Governed reusable product registration — implemented.** Owner-only product catalog supports code, identity, lifecycle, visibility, owner/support/docs metadata and integration mode; product registration is separate from customer access. Fixed an obsolete UI description which incorrectly suggested custom project applications were unimplemented.
7. **Custom project applications separate from reusable products — database and UI implemented.** Project application records are versioned, audited, manager-controlled, optionally shared with scoped clients, with server-side redaction of repository metadata and no automatic catalog-product subscription. Hosted schema and restricted RPC verified; no live production creation has been exercised.
8. **Project manager governance — database and UI implemented.** Owner-only manager overview and project manager appointment/revocation; managers cannot grant manager/HR/platform authority. Project-level access and active employee identity checks are enforced by PostgreSQL. The owner has effective manager access on the existing hosted project.
9. **Assign staff to projects — database and UI implemented.** Staff picker includes only active explicitly linked internal employee accounts. Project managers can assign contributors/viewers, while only platform owners can appoint managers. Existing active-task and accountable-owner safeguards prevent unsafe removal.
10. **Manager-assigned tasks and employee own-work isolation — implemented in source and isolated acceptance.** Manager task forms support employee assignees; assigned staff read their own tasks through internal self-service. Customers cannot view internal workforce. Hosted read-only permission checks denied an unrelated customer the project workforce and custom-app directories; actual hosted write and employee/browser acceptance remain unverified.
11. **Client onboarding beside Customer Directory — implemented.** Both entries are grouped under Organizations, separate from Employee onboarding under People, and guarded by platform-owner access.

## Additional corrections in this audit

- `views/products.html`: removed obsolete text saying that a custom application model still needs to be built.
- `tests/e2e/navigation.spec.js`: added `/admin/project-managers` to the cross-page owner desktop/mobile navigation acceptance route list.
- `docs/CUSTOMER_ONBOARDING.md` and `docs/operations/TOP_NAVIGATION.md`: reconciled outdated references to the November 9 migrations as not installed.

## Release gates still open

- One customer invitation remains queued and pending delivery. Provider configuration, running the opted-in `invitations` worker and real recipient acceptance must be verified before #4 is fully operational. The web server does not automatically start this worker or send emails.
- No newly verified recoverable hosted backup/restore rehearsal was supplied; atomic migrations and preservation checks do not substitute for disaster recovery.
- No real hosted browser sign-in, PostgREST session-scope, customer invite acceptance, manager/employee write or full tenant-permission matrix was exercised in this audit. Isolated Playwright/PostgreSQL tests are not a production substitute.
- Portal deployment status was not verified. The VSPH Supabase project being migrated does not itself deploy the Express application.
- Supabase security advisor warnings remain outside the #1–#11 feedback scope: `public.rls_auto_enable()` is an event trigger with an exposed EXECUTE grant, and leaked-password protection is not enabled. Review these separately with the Auth/operator settings; do not silently rewrite historical migration source.

## References

- [Current implementation status](PROGRESS.md)
- [Existing installation evidence](../operations/PROJECT_NOV09_MIGRATION_INSTALL.md)
- [Customer onboarding workflow](../CUSTOMER_ONBOARDING.md)
- [Project governance and permission model](../operations/PROJECTS_GUIDE.md)
- [Worker setup and external provider requirements](../operations/BACKGROUND_WORKERS.md)
