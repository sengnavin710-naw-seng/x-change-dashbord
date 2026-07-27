# AGENTS.md

## Project

SHWE LIN PAN is an internal exchange operations dashboard. It is a Bun and Turborepo
monorepo with a Next.js App Router web application, tRPC, Drizzle ORM, PostgreSQL,
Better Auth, Tailwind CSS, and shared workspace packages.

Read [README.md](README.md) and the relevant file in [docs](docs) before changing a
domain rule, database schema, authentication flow, or deployment configuration.

## General rules

- Use Bun only. Do not add npm, Yarn, or pnpm lockfiles.
- Inspect the current implementation before editing it.
- Preserve unrelated user changes.
- Follow the existing workspace boundaries and import packages through `@repo/*`.
- Make the smallest change that completely handles the request.
- Do not add dependencies unless the requested work requires them.
- Never commit real passwords, database URLs, access keys, session tokens, or auth
  secrets.
- Do not start a development server unless the user requests it or runtime verification
  requires it.

## Domain rules

- Do not infer business meanings that are not documented in
  [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).
- Keep Exchange formula profit separate from actual settlement variance.
- Keep Expenses separate from Profit; expenses are not deducted from dashboard profit.
- Use the fixed-decimal helpers for money and rates. Do not introduce floating-point
  calculations for financial values.
- Retrospective changes must continue to preserve revision history.

## Database changes

- Edit the Drizzle schema in `packages/db/src/schema.ts`.
- Generate a migration with `bun db:generate`.
- Review the generated SQL and commit both the SQL and Drizzle metadata.
- Apply committed migrations with `bun db:migrate`.
- Use `bun db:push` only for a disposable local or isolated test database.
- Never use `db:push` as a substitute for committed migrations on Neon, staging, or any
  shared database.
- Do not edit an already-applied migration. Add a new migration instead.

## Verification

Run checks in proportion to the change. The standard checks are:

```bash
bun check-types
bun lint
bun test:integration
bun run build
bun format:check
```

Integration tests require the local PostgreSQL service. A documentation-only change
requires formatting and link/content checks, not a production build.

## Documentation

Update the corresponding document when changing architecture, business rules, database
behavior, dependencies, deployment, operations, security, or testing. Exact dependency
versions remain authoritative in `package.json` files and `bun.lock`.
