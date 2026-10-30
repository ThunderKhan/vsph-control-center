# Customer onboarding — current durable workflow

The five-step wizard is retained at /admin/onboarding. It requires an active platform super_admin and a stable UUID Idempotency-Key. Same-key/same-payload retries return the same job; changed payload conflicts. Tenant, entitlements, grant, invitation/outbox and initial audit commit together. There is no compensating deletion of customer data or synchronous email in the HTTP request.

Follow [PROVISIONING_V2.md](operations/PROVISIONING_V2.md) for worker/provider setup, encryption, leases/retry/recovery and purpose-bound acceptance. /admin/provisioning is the recovery screen. Delivery remains disabled until separately approved/configured; no customer email was sent during implementation. Pending new profiles stay disabled. Existing identities must authenticate and never have their password reset by invitation acceptance. Exactly one intended membership activates, not all pending memberships.

Apply reviewed 002/003/004 migrations to isolated staging before backend rollout. The final disable-revocation migration is mandatory; it preserves explicit administrator disables and consistent lock ordering with acceptance. Native regression tests cover concurrent disable/acceptance. External Auth operations cannot join a PostgreSQL transaction: uncertain enrollment failures require explicit provider reconciliation and invalidate the capability.

Outstanding legacy invitations require operator reconciliation and new purpose-bound invitations; this migration does not invent trusted state from old bearer links. Expired/revoked invitations need a new reviewed invitation workflow; automated replacement invitations/customer-admin self-service remain M3/M4 work. Existing-tenant individual invite management is outside the new-customer wizard.

Production release still requires real Auth/SMTP/provider/staging UAT. Do not infer deliverability or hosted migration state from CI fixtures.
