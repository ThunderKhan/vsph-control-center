# HR appointment and shared control repair — 5 November 2026

## Observed cause

Read-only inspection of the reported `ayan@vsph.test` record found an active roster entry but no matching Auth identity, no active ordinary portal profile, no accepted employee link, no pending link request and no HR grant. An employee record does not create a login. The grant rejection was correct; offering a direct grant with a generic invitation error was misleading.

No hosted records, credentials, consent requests or permissions were changed. This repair requires **no database migration** and uses existing installed functions. Do not seed, reset, insert Auth records through SQL or link this employee to the owner's account to bypass enrollment.

## Correct workflow

1. Owner opens Employees or HR access governance and selects **Review HR access**.
2. The review shows activation, account enrollment, pending consent, accepted consent or existing HR authority. An absent account cannot request consent or receive HR.
3. Complete approved portal identity enrollment with the exact work email if needed. New-identity employee enrollment remains a separate outstanding capability; this screen does not send real email, create accounts or passwords. Existing ordinary active accounts can proceed immediately.
4. Request the account link. The employee signs in as themselves, opens **My employment**, and accepts using their password and enrolled MFA. Owner approval cannot substitute for employee consent.
5. Owner refreshes the review and selects **Grant HR**. SQL rechecks authority, account, session, roster version and consent under locks. HR cannot appoint HR. Revocation remains available from governance and Employees.

Readiness is a non-authoritative read model. Profile reads occur only after owner and employee authorization; no private profile identifiers are returned. Failed provider reads fail closed. Concurrent changes remain governed by the existing transactional RPC and conflict responses. No customer/product/project grants are implied.

## UI review scope and acceptance

Reviewed shared navigation and control styles, employee tables, HR governance, identity forms, project actions and the shared administrative stylesheet. Corrected adjacent link/button collisions using wrapping action groups with 8–12 px gaps, 44 px control heights, styled action links without underlines, administrative checkbox dimensions and project-action wrapping. Existing navy/blue/Inter design, focus rings and mobile drawer remain.

Chromium acceptance covers the 15 existing authenticated navigation routes on desktop and mobile, attaches full-page screenshots and rejects visible main-content buttons below 44 px. Employee acceptance additionally measures non-overlapping row action geometry, verifies account-required controls stay disabled, and completes consent then owner appointment through the actual UI against isolated PostgreSQL with simulated Auth. This does not prove every possible populated production state or live Auth/email enrollment.

Rollback: revert application files; no schema rollback or data repair is needed. Existing SQL authorization continues to protect old clients. No dependency versions were changed.

## Verified merge and evidence

[PR #79](https://github.com/ThunderKhan/vsph-control-center/pull/79) merged as `9e810d916c3a5efdb1526a14ffe1043cdba71cf9`. [Code CI and screenshot artifact](https://github.com/ThunderKhan/vsph-control-center/actions/runs/41977548164) passed all four jobs: 166 Node, 44 PostgreSQL and 68 Chromium passed with two intentional skips on both launchers, plus quality, dependency, advisor and synthetic restore checks. Thirty navigation screenshots cover desktop/mobile. The test Auth provider is simulated; the database is native PostgreSQL. No live Auth acceptance, hosted permission grant or email delivery is claimed.

The broader screenshot pass also found standalone organization/product selectors touching their paging controls. The shared administrative stylesheet adds a 12 px vertical gap and wrapping 44 px breadcrumb targets; Chromium measures the selector/action separation on Customers, Products and My organizations at both viewports.
