# Database and Migrations

## Technology

- PostgreSQL 17 for local Docker development
- Neon PostgreSQL for staging
- Drizzle ORM for queries and schema definitions
- Drizzle Kit for migration generation
- `pg` as the PostgreSQL driver

The schema source of truth is `packages/db/src/schema.ts`. Committed migrations live in
`packages/db/drizzle`.

## Tables

| Table                   | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `user`                  | Provisioned users and active status                               |
| `session`               | Better Auth sessions                                              |
| `account`               | Better Auth credentials and provider accounts                     |
| `verification`          | Better Auth verification records                                  |
| `exchange_rate_version` | Effective, versioned exchange rate configuration                  |
| `opening_balance`       | Opening Balance and Currency Exchange Balance configuration       |
| `exchange_transaction`  | Exchange inputs, calculated values, actual payout, and void state |
| `cash_bank_transaction` | Cash/Bank principal, movement, profit, currency, and void state   |
| `expense`               | THB or MMK expenses and void state                                |
| `record_revision`       | Create, update, and void audit history                            |

`opening_balance` and some of its column names are retained for database compatibility.
Application terminology is defined in [BUSINESS_RULES.md](BUSINESS_RULES.md).

## Numeric representation

- Money: `numeric(20,4)`
- Rates and spreads: `numeric(18,8)`
- API values: decimal strings
- Calculation values: scaled `bigint`

Do not convert stored financial values to JavaScript `number` for calculations.

## Local database

Create `.env` from `.env.example`, start PostgreSQL, and apply the current schema:

```bash
docker compose up -d postgres
bun db:push
```

`db:push` is allowed only for a disposable local database or the isolated integration
test setup. It is convenient during local development but does not create a reviewed
deployment history.

## Migration workflow

Use this workflow for every schema change that can reach staging or production:

1. Edit `packages/db/src/schema.ts`.
2. Generate a migration:

   ```bash
   bun db:generate
   ```

3. Review the generated SQL and Drizzle metadata under `packages/db/drizzle`.
4. Test the migration against a new or backed-up database.
5. Run:

   ```bash
   bun db:migrate
   ```

6. Commit the schema change, SQL migration, snapshot, and journal together.

Never edit a migration that has already been applied to a shared database. Add a new
forward migration instead.

## Staging migrations

The Netlify staging build runs the committed migrations before building the web
application:

```bash
bun run db:migrate && turbo run build --filter @repo/web
```

The build environment must provide the Neon `DATABASE_URL`. Do not use `db:push` against
Neon staging.

## Test databases

Integration tests use isolated databases configured through `TEST_DATABASE_URL` and the
test preparation script. The current test setup uses dedicated databases such as
`app_test` and `app_api_test` and must not clear the development `app` database.

Run:

```bash
docker compose up -d postgres
bun test:integration
```

## Backup and recovery

- Create a provider backup or restore point before a risky migration or bulk import.
- Test restoration before relying on a backup procedure.
- Export data before an Excel migration or large correction.
- A Netlify code rollback does not reverse Neon schema changes.
- Prefer backward-compatible migrations and forward fixes.
- Never delete or recreate a shared database as part of routine troubleshooting.
