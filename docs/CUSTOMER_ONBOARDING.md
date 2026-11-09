# Customer organization creation — four-step owner workflow

## Role and purpose

Feedback #4 is creation of customer organizations and assignment of the customer's rightful owner. Only an active VSPH platform super administrator may begin it. Organization ownership is not a platform administrator role. Internal employee management and VSPH internal projects are separate authorization domains.

Owner entry point: Organizations → Client onboarding, or Customer Directory → Create organization. Route: /admin/onboarding.

## Creation flow

1. Organization details: customer company name and unique lowercase workspace identifier. The availability request is advisory; the database unique constraint is authoritative.
2. Customer owner: full name and email. The owner is invited to accept membership and choose a password; no active account or product session is provisioned by this form.
3. Product access: optional. Organization only is the default and produces no subscriptions/grants. Alternatively choose active catalog products and configure individual plans, trial or active status and dates. No payment is processed.
4. Review: independently editable details with fresh confirmation after changes. Creating records is a separate intentional submit.

A successful server response displays the created organization/slug, queued invitation (not sent), and explicit catalog-product count. The user can open the organization, create a customer project or inspect invitation delivery. Project memberships and custom application records are separate.

## Durable idempotency and recovery

For product-backed setup, existing provisioning_command begins one atomic job with organization, subscriptions/grants, invitation/outbox and audit. Organization-only setup uses organization_only_onboarding, which creates no catalog entitlement. Both require an active platform owner, strict field validation, UUID request identity, exact-payload idempotency and durable audit.

GET /api/admin-management/onboardings/availability?slug=... previews slug availability for the owner only.
GET /api/admin-management/onboardings/requests/:key retrieves only a job created by the current owner, for interrupted-response recovery. The browser retries only the original UUID. Old POST /api/admin-management/organizations now returns HTTP 410 instead of creating an orphan tenant without any owner.

Email provider side effects are asynchronous. The approved invitation dispatcher must run, and acceptance must be completed by the invited person. Existing accounts are not assigned new passwords. In-flight/ambiguous delivery or acceptance requires established provisioning recovery and replay/revocation. See docs/operations/PROVISIONING_V2.md.

## Database installation and acceptance

Product-backed provisioning **and the organization-only SQL migration** (`20261109141500_organization_only_onboarding`) are installed on the existing configured VSPH Supabase project as of November 9, 2026. The November 9 installation validated the full 44-entry canonical history, preserved 14 existing data-table fingerprints, and verified service-only execution grants; see [verified installation evidence](operations/PROJECT_NOV09_MIGRATION_INSTALL.md). The new feature still requires live invitation delivery and customer acceptance testing before production launch. Other environments need their own reviewed forward installation and backup/restore verification. Do not rerun the historical installer or seed test customers into a live project.

Verify end-to-end in a controlled environment: owner submits once; organization/job/invitation/outbox persist; no unauthorized product access; worker sends a real invitation via approved provider; intended customer accepts; owner membership activates only on acceptance; customer sees only own organization and explicitly shared project information. Isolated Node/PostgreSQL/Chromium fixtures validate code and permission boundaries, not email deliverability or a deployed frontend.

On a lost response, check the original request and reuse the same key. On a slug collision, edit the identifier. On delivery failure, use Provisioning Recovery. Never delete another organization's records or unreviewed tenant data to recover.

The organization-only migration is independent of custom-project application migrations. An unresolved creation request cannot be edited and submitted with a changed payload; operators must check or retry the original idempotency key.
