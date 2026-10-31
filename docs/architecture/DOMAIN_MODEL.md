# Domain and ownership

Organizations are customers or VSPH internal tenants. Applications are products. Subscriptions are product entitlements, never receipts. Membership is identity within an organization. A product role scopes actions within one organization/application pair.

Projects are first-class internal work or client engagements, distinct from applications and subscriptions. One project may link multiple products; many projects can deliver a product. Each project has an accountable owner, project memberships, milestones, tasks, link deliverables, releases and deployments. Project assignments never imply product access. Internal work is private; customer visibility must be explicit per shared record.

Central operations and customer administration will use the same Postgres database and Express UI initially, with separate server authorization paths and navigation. Music operational data stays behind its independently deployed service; Control Center does not replace Music with portal sample records. Customer ownership does not grant platform administration. Platform administration is not automatically a product staff identity.

Existing relationships: auth.users → profiles → organization_memberships; organizations + applications → subscriptions and organization_app_access; memberships + access + app_roles → user_app_roles; portal_sessions → app_sessions (cascade on logout). SSO launch codes reference identity, tenant, product and a portal hash, but do not have a portal FK.

Project tables enforce same-project and same-tenant relationships at the database layer as well as in API predicates. Links start as HTTPS metadata only; attachments require separate policy and storage review.

Phase 2 implementation: project tables/functions and explicit role matrix are in PROJECTS.md. Provisioning jobs, membership invitations and encrypted invitation outbox are a separate workflow domain, not projects or product subscriptions. Development teams are per-project membership labels in this MVP.

Phase 3 adds project-specific GitHub App installation approvals → repository connections → read-only provider observations → immutable delivery event snapshots. Task/milestone links reference provider observations in the same project. Repository ownership remains at GitHub; Control Center is not a source-control server. Optional webhooks enqueue canonical polling, not untrusted payload facts.

Project notification outbox → user inbox is a separate delivery workflow with personal preferences and current permission checks. Reports derive from scoped project work and ingested observations. Product adapter registry remains separate from both project permissions and organization entitlements. Public session UUIDs are display/revocation identifiers, never authentication credentials. No Vercel mapping, live deployment or enterprise health metric is inferred from a similar product name.
