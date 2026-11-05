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
