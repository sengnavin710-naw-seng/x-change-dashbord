# Operations Runbook

## Local startup

From the repository root:

```powershell
Copy-Item .env.example .env
bun install
docker compose up -d postgres
bun db:push
bun dev
```

Open `http://localhost:3000`.

Use placeholder-safe local credentials in `.env`. Do not overwrite an existing `.env`
without reviewing its values.

## Account lifecycle

Public registration is disabled. Run account commands only from a trusted administrator
terminal connected to the intended database.

Create an account:

```bash
bun auth:user:create --email employee@company.com --name "Employee Name"
```

Change a password and revoke existing sessions:

```bash
bun auth:user:set-password --email employee@company.com
```

Disable an account and revoke existing sessions:

```bash
bun auth:user:disable --email employee@company.com
```

Enable an account:

```bash
bun auth:user:enable --email employee@company.com
```

Revoke sessions without disabling the account:

```bash
bun auth:user:revoke-sessions --email employee@company.com
```

Password prompts are hidden. Automation may use `--password-stdin`, but passwords must
never be passed as command-line arguments.

## Database operations

Start local PostgreSQL:

```bash
docker compose up -d postgres
```

Check services:

```bash
docker compose ps
```

Apply committed migrations to the configured database:

```bash
bun db:migrate
```

Synchronize only a disposable local database directly from the schema:

```bash
bun db:push
```

Never run `db:push` against staging or production.

## Transaction corrections

- Correct or void records through the application, not direct SQL.
- Enter an accurate reason when requested.
- Confirm the selected transaction date and currency before saving.
- Verify the affected date range in Total Profit, Summary Details, balances, and
  transaction history.
- Retain the revision record; do not delete audit history during normal operations.

## Rate operations

- Configure the Base Rate and both customer-facing rates before entering exchange
  transactions that require them.
- A saved rate remains effective until a later rate version becomes applicable.
- Use an override only for an exceptional transaction and record the reason.
- Do not rewrite an old rate version to change unrelated historical transactions.

## Balance operations

- Opening Balance records the shop's initial capital.
- Currency Exchange Balance is the carried-forward exchange balance for the selected
  calculation start date.
- Confirm THB, MMK, and the calculation date before saving.
- Balance Setup is configuration data; do not repeatedly replace it to correct a single
  transaction.

## Deployment monitoring

After a staging push:

1. Confirm the expected commit appears in Netlify Deploys.
2. Confirm migration and build steps succeed.
3. Wait for `Published`.
4. Sign in and load the Dashboard.
5. Check Netlify Function logs for new errors.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed recovery steps.

## Incident response

When the application fails:

1. Record the environment, route, action, and time.
2. Avoid repeatedly submitting a mutation.
3. Check the newest Netlify Function error or local terminal error.
4. Determine whether the failure is authentication, database connectivity, missing
   migration, validation, or application code.
5. Back up shared data before a corrective migration or bulk repair.
6. Verify the fix in staging before production.

Do not share database URLs, auth secrets, passwords, access keys, tokens, or unsanitized
logs.

## Secret cleanup

Remove temporary environment variables from a PowerShell session after a staging
operation:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:BETTER_AUTH_SECRET -ErrorAction SilentlyContinue
Remove-Item Env:BETTER_AUTH_URL -ErrorAction SilentlyContinue
Remove-Item Env:BETTER_AUTH_TRUSTED_ORIGINS -ErrorAction SilentlyContinue
Set-Clipboard -Value ""
```

Rotate any secret that appeared in a screenshot, log, commit, or message.
