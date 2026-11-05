# Real role accounts on the normal portal

This operator command uses the existing server `.env` and real Supabase Auth. It does not start a fixture server or change the portal port. Account passwords are unique random values stored in an account-protected private directory outside the repository. No shared password is committed or printed.

```powershell
cd D:\Projects\vsph-control-center
npm run accounts:setup -- --project-ref zbmerhexucqxazuxjmmw
npm run dev
```

The setup asks for the existing platform owner's password, and enrolled authenticator code when supported. It preserves that owner and password rather than creating an unnecessary second privileged owner. It creates three operator-controlled test identities: HR manager, employee and basic customer. Open the reported private `LOGIN_DETAILS.json` file to obtain their emails/passwords, then sign in normally at `http://localhost:3000/login`. The `.test` addresses are login identifiers only: email is explicitly confirmed for these controlled test accounts and no email is sent. This is an operator testing tool, not general customer/employee enrollment.

The new HR and employee records use existing roster, consent and permission RPCs. Consent is accepted only for the newly operator-owned identities after real provider password verification; normal employees still accept their own requests. Temporary setup sessions are removed. HR can manage the internal workforce but cannot appoint HR. Employees see only their own work/leave/attendance; initially no project tasks have been assigned. The basic customer owns one newly created test organization, receives no product roles or subscriptions and cannot access HR. Grant products through the existing governed entitlement workflow if needed. Platform owners never inherit product roles.

The same protected `accounts.json` is reused after provider failures. Do not delete it to retry; rerun the same command. Server-owned Auth metadata must match the run and original operator, otherwise setup stops without changing the account. Existing passwords, accounts, subscriptions, organization assignments and revoked/disabled identity states are not overwritten. Local concurrent runs are excluded by `setup.lock`; after an interrupted process, confirm no setup process remains before removing that lock. A rerun explicitly reconciles this run's HR grant. No existing customer database reset or seed runs. No migration is needed.

Native integration tests cover partial provider failure/retry, duplicate prevention, foreign Auth collisions, owner-only setup, current sessions, real SQL consent, HR authority and separate customer scope. The test provider is simulated: this is not proof of hosted Auth/PostgREST acceptance.

## Execution boundary

The connected Supabase management tools expose SQL but no Auth-admin user creation. This Work session has no access to the server key in the operator's Windows `.env`. Therefore the hosted accounts cannot be honestly reported as created here. The command performs that authorized action on the machine which already holds the server configuration, without transmitting its secrets. Review the private output rather than sharing passwords or `.env` contents in chat.

## Owner selection and recovery

If multiple active platform owners exist, select the account whose password you know:

```powershell
npm run accounts:setup -- --project-ref zbmerhexucqxazuxjmmw --owner-email "your-existing-owner@example.com"
```

Replace the example email with your actual portal-owner login. Existing accounts/passwords are never changed by selection. If the owner has several enrolled authenticators, setup lists their IDs/names and stops; rerun with `--factor-id UUID` for one listed authenticator. Password and TOTP entry remain hidden. `npm run accounts:setup -- --help` works without credentials or an interactive terminal.

Failures now identify the stage and safe recovery instruction. Raw dependency errors, SQL details and credentials are never printed. Requests time out after 15 seconds per attempt and refuse redirects; any SDK retries receive the same per-attempt deadline. Provider failure still requires reuse of the same protected private state. New state binds to the selected owner; old state is bound only after its server-owned Auth markers have been validated successfully. A lock error never deletes another process's lock automatically.

An expired or roster-stale pending consent from the exact same setup run is renewed through the existing owner/session/version-checked SQL workflow, then accepted only after fresh provider verification. Cancelled or previously revoked consent requires governance review and is not automatically overridden. Verification time is captured immediately after the provider check, so later network delays cannot manufacture fresh assurance. Success is printed only after temporary-session and lock cleanup completes.
