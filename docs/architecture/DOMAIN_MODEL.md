# Domain and ownership

Organizations are customers or VSPH internal tenants. Applications are products. Subscriptions are product entitlements, never receipts. Membership is identity within an organization. A product role scopes actions within one organization/application pair.

Projects are planned first-class internal work or client engagements, distinct from applications and subscriptions. One project may link multiple products; many projects can deliver a product. Each project has an accountable owner, project memberships, milestones, tasks, link deliverables, releases and deployments. Project assignments never imply product access. Internal work is private; customer visibility must be explicit per shared record.

Central operations and customer administration will use the same Postgres database and Express UI initially, with separate server authorization paths and navigation. Music operational data stays behind its independently deployed service; Control Center does not replace Music with portal sample records. Customer ownership does not grant platform administration. Platform administration is not automatically a product staff identity.

Existing relationships: auth.users → profiles → organization_memberships; organizations + applications → subscriptions and organization_app_access; memberships + access + app_roles → user_app_roles; portal_sessions → app_sessions (cascade on logout). SSO launch codes reference identity, tenant, product and a portal hash, but do not have a portal FK.

Future project tables must enforce same-project and same-tenant relationships at the database layer as well as in API predicates. Links start as HTTPS metadata only; attachments require separate policy and storage review.
