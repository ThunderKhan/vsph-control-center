# ADR-001: Incremental modular monolith and separate products

Status: accepted for implementation, 31 October 2026.
Keep Express, vanilla JS, Supabase Postgres/Auth and DESIGN.md. Central customer and portfolio operations share a database and UI with explicit permissions. Music remains separately deployed. Avoid replacing product roles with project team assignments. Keep external SSO disabled until the actual domain-to-repository binding, receiver, secrets and staged authorization are proven.

Privileged server access is a material risk: use scoped query helpers, transaction functions with fixed search_path, revoked public execution and database-backed negative tests. SQL transactions cannot atomically include Supabase Auth/email; use durable workflows and external outbox in M2. Do not use compensation as proof of atomicity.

Consequences: smaller reviewable PRs and no wholesale redesign; authorization must be checked at every boundary. No production certification, payment, uptime or SSO readiness claim follows from UI or passing unit tests.
