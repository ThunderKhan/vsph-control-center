# Route authorization matrix

The original portal/product rows are retained below; current Projects authorization is specified in PROJECTS.md and durable invitations in operations/PROVISIONING_V2.md. Cookies are opaque hashes; browser writes require exact PUBLIC_ORIGIN. Exceptions are confidential SSO exchange and introspection.

| Routes                                             | Boundary                                                            | Failure cases / pending verification                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| GET /login, /accept-invite                         | Public, login optionally resolves portal                            | Disabled/stale cookie must not redirect loop; invite landing grants nothing      |
| POST /api/auth/login                               | Public credentials                                                  | Invalid input, enumeration, brute force, parallel attempts                       |
| GET /api/auth/me, /dashboard, /applications        | Active profile + live portal session                                | Anonymous/expired/deleted session: API 401 or page redirect                      |
| POST /api/auth/app-login                           | Portal + same identity reauthentication + permitted selected org    | Wrong tenant, expired subscription, inactive membership/role/grant               |
| /apps/:app/home, /api/apps/:app/{context,records}  | Portal + app session bound to portal/user/app/org + current context | Cross-tenant IDs ignored for authority; baseline only viewer blocked on write    |
| /api/apps, /api/workspaces                         | Portal + filtered entitlement/membership                            | No broad data returned to ordinary users; bounded query work needed              |
| /admin, /admin/onboarding, /api/admin-management/* | Active platform super_admin                                         | Ordinary/customer owner/product staff/musician 403; no customer self-service yet |
| POST /api/invitations/accept                       | Origin + Supabase verified bearer + pending membership              | Purpose/expiry/replay races require durable invitation state                     |
| /api/sso/config/MUSIC, /authorize                  | Portal + current Music entitlement; fixed configured destination    | Invalid state/challenge/client/tenant; missing config 503                        |
| POST /api/sso/exchange                             | Confidential server secret + single-use code + PKCE + live context  | Replay/wrong secret/verifier/revocation                                          |
| POST /api/sso/introspect                           | Confidential server secret + exact session/user/tenant              | Disabled profile/expired session/revoked membership/grant                        |
| POST logout/app-logout                             | Origin; app logout also portal                                      | Cookie deletion plus durable session delete/cascade                              |
| GET /api/health                                    | Public dependency probe                                             | 503 unconfigured/unavailable; no secrets                                         |

Target permission families: platform.customer.manage, platform.identity.manage, platform.portfolio.manage; organization.member.invite / role.assign within permitted tenant; product.record.read/write by product role; project.manage / assigned-task.update / shared-record.read independently of product grants. None is implemented merely by naming it here.

## Phase 2 boundaries

- /api/projects and /projects: active portal identity. Portfolio creation is platform super_admin only; project detail/mutations use explicit project roles and current tenant sharing. Database versions serialize edits and activity/audit commit with data. See PROJECTS.md.
- POST onboarding: platform admin + strict payload + UUID Idempotency-Key. No synchronous Auth/email writes.
- /admin/provisioning and retry/revoke/recover: platform admin, bounded job reads, state/lease/reconciliation checks and audits.
- Invitation inspect/accept: exact purpose capability + expiry/state; existing identity additionally authenticates as that user. Only target membership activates; broad bearer activation removed. New account enrollment may not override explicit disable.
