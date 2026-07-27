# Testing

## Test layers

| Layer             | Purpose                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| Typecheck         | Detects TypeScript contract errors across workspaces                                   |
| Lint              | Enforces code-quality and framework rules                                              |
| Integration tests | Verifies auth, protected tRPC, calculations, database writes, revisions, and summaries |
| Production build  | Verifies Next.js route compilation and deployment bundling                             |
| Manual smoke test | Verifies browser, language, responsive UI, and end-to-end operations                   |
| Excel parity test | Compares confirmed Excel rules and totals with the web application                     |

## Standard checks

```bash
bun check-types
bun lint
bun test:integration
bun run build
bun format:check
docker compose config
```

Documentation-only changes require formatting and content/link checks. Database,
authentication, API, or calculation changes require the relevant integration tests.

## Integration test setup

Start local PostgreSQL:

```bash
docker compose up -d postgres
```

Configure `TEST_DATABASE_URL` with a dedicated test database, then run:

```bash
bun test:integration
```

The preparation script uses isolated test databases such as `app_test` and
`app_api_test`. Tests must never clear the development `app` database or any Neon
database.

Current integration suites cover:

- Better Auth sign-in and provisioned account behavior
- Active/disabled accounts and session revocation
- Protected tRPC procedures
- Exchange rate versions
- Exchange, Cash/Bank, and Expense operations
- Dashboard totals and balances
- Historical updates, voids, and revision history

## Manual smoke test

### Authentication

- Incorrect credentials show a short field-level error.
- An active provisioned account can sign in.
- A disabled account cannot sign in.
- Sign out removes access to protected routes.
- English/Burmese switching works on login and dashboard pages.

### Mobile

- Login works from a real phone over HTTPS or an approved LAN origin.
- The mobile navigation button opens the left drawer.
- Forms fit the viewport without clipped Date & Time fields.
- Date filter popovers remain anchored and usable.
- History columns remain readable with the intended horizontal behavior.

### Transactions

For Exchange, Cash/Bank, and Expense:

- Create a record with a known expected result.
- Confirm Date & Time, currency, amount, description, and direction.
- Confirm Latest Transactions and the corresponding history page update.
- Confirm Total Profit, Summary Details, and balances update where applicable.
- Edit the record and verify all affected ranges recalculate.
- Void the record and verify it disappears from active totals.

## Excel parity testing

Use an isolated database and a read-only copy of the source workbook.

1. Define the exact workbook version and worksheet.
2. Map each supported Excel column to an application field.
3. Exclude confirmed legacy helper columns and separator rows.
4. Identify broken or missing Excel formulas before import.
5. Import or enter a small representative sample first.
6. Compare transaction-level calculated payout and profit.
7. Compare daily Exchange Profit, Cash/Bank Profit, and Expenses by currency.
8. Compare selected-period and full-month totals.
9. Compare Currency Exchange Balance for known dates.
10. Document every difference as a mapping issue, Excel formula issue, import issue, or
    application defect.

Do not change application formulas merely to reproduce a broken Excel cell. The
confirmed rules in [BUSINESS_RULES.md](BUSINESS_RULES.md) are authoritative.

Only after a sample passes should a complete workbook import be tested. Back up the
target database first and never import test data into production.

## Migration verification

For a new migration:

1. Create a new temporary database.
2. Apply every committed migration from an empty state.
3. Verify the expected tables, indexes, constraints, and enums.
4. Run the exact query or mutation affected by the schema change.
5. Run integration tests.
6. Remove only the confirmed temporary database.

Also test applying the new migration to a copy of the previous schema state.

## Staging acceptance

After Netlify reports `Published`:

- Sign in with a staging-only provisioned account.
- Load every dashboard route.
- Perform non-sensitive test transactions.
- Verify totals and revisions.
- Review the newest Netlify Function logs.
- Repeat the primary flow on desktop and phone.

Do not approve production deployment while staging has unresolved server errors,
migration failures, unexplained Excel differences, or exposed secrets.
