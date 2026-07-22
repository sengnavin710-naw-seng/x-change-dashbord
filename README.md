# X-Change Dashboard

Full-stack monorepo foundation built with Bun, Turborepo, Next.js App Router, tRPC,
TanStack Query, Zod, Drizzle ORM, PostgreSQL, Better Auth, Tailwind CSS, and shadcn/ui.
Authentication uses administrator-provisioned email/password accounts with no public
registration. The authenticated workspace includes the initial exchange, Cash/Bank,
expense, opening-reconciliation, daily-summary, and retrospective-correction foundation.

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or newer
- Docker with Docker Compose

## Install

1. Create a local environment file:

   ```sh
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env`.

2. Replace the placeholder values in `.env` for your local environment.

3. Install dependencies:

   ```sh
   bun install
   ```

4. Start PostgreSQL and synchronize the Drizzle schema:

   ```sh
   docker compose up -d postgres
   bun db:push
   ```

   PostgreSQL is exposed on port `5433` by default to avoid common conflicts with a
   locally installed PostgreSQL service. Override `POSTGRES_PORT` if needed.

5. Provision the first account. The password is collected through a hidden prompt:

   ```sh
   bun auth:user:create --email employee@company.com --name "Employee Name"
   ```

## Start development

Start PostgreSQL:

```sh
docker compose up -d postgres
```

Synchronize the local database schema:

```sh
bun db:push
```

Start the web application from the repository root:

```sh
bun dev
```

Open <http://localhost:3000>.

## Quality checks

```sh
bun check-types
bun lint
bun run build
bun test:integration
bun format
docker compose config
```

Integration tests require the PostgreSQL service. They create and use the isolated
`app_test` and `app_api_test` databases and never clear the development `app` database.

## Operations workspace

The dashboard opens on today's date in the `Asia/Yangon` timezone. Its primary labels
are Burmese with English support labels. Current modules are:

- Exchange transactions with formula profit and actual-settlement comparison kept separate.
- Cash/Bank service transactions in both directions.
- THB and MMK expenses, shown separately from profit.
- Reference and operational opening balances, kept unreconciled until external evidence exists.
- Retrospective exchange corrections with a required reason and preserved revision history.

Legacy Excel columns H, I, and the yellow Summary band are intentionally excluded until
their business meaning is confirmed. No sample business records are inserted.

## Provisioned account operations

Public email/password registration is disabled. Account lifecycle operations run only
from the repository CLI:

```sh
bun auth:user:create --email employee@company.com --name "Employee Name"
bun auth:user:set-password --email employee@company.com
bun auth:user:disable --email employee@company.com
bun auth:user:enable --email employee@company.com
bun auth:user:revoke-sessions --email employee@company.com
```

Password prompts are hidden. For automation, each password-taking command accepts
`--password-stdin`; never pass a password as a command-line argument.

## Workspace layout

- `apps/web` - Next.js App Router application, Tailwind, shadcn/ui configuration, and
  tRPC/TanStack Query client integration.
- `packages/api` - protected tRPC operations, exact fixed-decimal calculations, dashboard
  queries, and integration tests.
- `packages/auth` - Better Auth server configuration, protected sessions, provisioned
  account services, CLI operations, and PostgreSQL integration tests.
- `packages/db` - PostgreSQL/Drizzle client, Better Auth and operations schemas, revision
  history, and local/test schema synchronization scripts.
- `packages/ui` - shared shadcn/ui package and component utilities.
- `packages/config` - shared TypeScript, ESLint, Prettier, and S3 client configuration.
- `packages/types` - shared infrastructure types.

## Containers

Run only PostgreSQL during local development:

```sh
docker compose up -d postgres
```

Build and run the production web container with PostgreSQL:

```sh
docker compose up --build web
```

The environment values in `.env.example` and Compose defaults are placeholders only.
Use secret management and production-grade credentials outside local development.
