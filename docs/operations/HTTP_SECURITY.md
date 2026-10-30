# HTTP boundary controls — M1 increment

All responses receive a generated request ID, no-sniff, frame denial, no-referrer, permissions policy and CSP. APIs including workspace counts/errors are no-store. Production enables HSTS without includeSubDomains/preload. The only permitted inline script is the exact hash of the existing dashboard pre-paint preference; arbitrary inline JS/eval is denied. Existing inline styles and Google fonts remain allowed; removing inline styles is separate work.

JSON/form bodies are capped at 100kb, form parameters at 50. Parse/size errors return 400/413 with generic text; unexpected errors return 500 with a request ID. Central error logging contains event/status/request ID only. Existing onboarding-specific logs still require M11 review; this does not certify all logs as free of sensitive data.

Default Express proxy trust is false. Configure TRUST_PROXY only with independently verified proxy IPs/subnets or a documented proxy-addr range. Numeric hop counts and blanket true are rejected. A direct client's X-Forwarded-For cannot select its limiter bucket. Operators must validate actual ingress topology before rollout; an incorrect proxy allowlist can make shared proxy clients share a bucket.

Login, app-login and invite-accept share a 20 attempts / 15 minutes / source IP budget. Confidential exchange/introspection share 300 requests / minute / source IP. Limits count all attempts, including failures and successes; no email, body, cookie or token is stored as a key. Fixed windows bound memory to 10,000 addresses; saturation fails closed. Budgets can affect large shared networks or busy receivers and must be measured in staging.

This limiter is SINGLE PROCESS only. Multiple instances/restarts do not share counters. Distributed durable/edge limits, password-spray detection, configurable verified ingress policy and operational metrics remain production gates. Do not claim fleet-wide brute-force protection.

Tests exercise actual Express HTTP responses, concurrent throttles, spoofed forwarded IPs, expiry/reset, bounded saturation, CSP hash, safe errors and request identifiers. They do not prove tenant/identity authorization, which remains separate in M1.

Rollback: revert this code PR; no migration or hosted configuration was applied. Before deployment, verify login, app login, onboarding/invite, all scripts/fonts and Music back-channel traffic in staging. Review proxy ranges and shared-IP traffic rather than weakening production trust to true.
