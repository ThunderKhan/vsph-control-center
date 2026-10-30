# Current capability matrix

| Domain                                    | Baseline                                                       | Required gate                                                        |
| ----------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Portal, mobile sidebar, product directory | Implemented; 77 baseline tests; anonymous browser checks added | Authenticated staging browser coverage                               |
| Tenant isolation                          | Server predicates and fail-closed RLS                          | Full real DB-backed HTTP role matrix                                 |
| Customer onboarding                       | Wizard, pending membership, Supabase invite                    | Durable workflow, staged SMTP, safe invite state                     |
| Roles, subscriptions                      | Platform admin CRUD, coarse product roles                      | Customer self-service, separation of duties, lifecycle               |
| Music SSO                                 | Portal handshake; receiver PR open                             | Proven deployment binding, persistent operations backend, staged E2E |
| Projects/delivery/releases                | Absent                                                         | M7/M8 complete vertical workflows                                    |
| Notifications/reporting                   | Basic audit list and access counts                             | Outbox, immutable events, truthful reconciled metrics                |
| Operations                                | Health endpoint, basic CI                                      | Rate controls, observability, restore/load/security exercises        |

Validation changes add native PostgreSQL migration/constraint/concurrency tests and Chromium anonymous smoke checks. They do not stand in for Supabase Auth or full authenticated UAT.
