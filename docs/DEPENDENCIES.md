# Dependencies

## Source of truth

Exact dependency ranges are declared in the root and workspace `package.json` files. The
resolved dependency graph is locked by `bun.lock`.

This document explains why major dependencies exist. Do not duplicate every transitive
package or resolved patch version here.

## Runtime and workspace tooling

| Dependency | Location            | Purpose                                                 |
| ---------- | ------------------- | ------------------------------------------------------- |
| Bun        | Root                | Runtime, package manager, scripts, and test runner      |
| Turborepo  | Root                | Coordinates build, dev, lint, typecheck, and test tasks |
| TypeScript | Root and workspaces | Strict static typing                                    |
| ESLint     | Root/config         | Static code-quality checks                              |
| Prettier   | Root/config         | Consistent formatting                                   |

The repository supports Bun only. Do not add `package-lock.json`, `yarn.lock`, or
`pnpm-lock.yaml`.

## Web application

| Dependency                          | Purpose                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Next.js                             | App Router application, server rendering, route handlers, and deployment runtime |
| React / React DOM                   | Component rendering                                                              |
| Tailwind CSS                        | Utility-based styling                                                            |
| TanStack Query                      | Client query cache, loading state, and invalidation                              |
| tRPC client and React Query adapter | End-to-end typed API calls                                                       |
| Better Auth client                  | Email/password sign-in and session client                                        |

These dependencies are declared in `apps/web/package.json`.

## API and validation

| Dependency     | Purpose                                         |
| -------------- | ----------------------------------------------- |
| `@trpc/server` | Routers, procedures, contexts, and typed errors |
| Zod            | Environment, input, and command validation      |
| Drizzle ORM    | Typed PostgreSQL queries and transactions       |

The API depends on the internal `@repo/auth`, `@repo/db`, and `@repo/types` workspaces.

## Authentication

| Dependency  | Purpose                                               |
| ----------- | ----------------------------------------------------- |
| Better Auth | Email/password authentication and session management  |
| Drizzle ORM | Better Auth PostgreSQL adapter and account operations |
| Zod         | Password, email, and environment validation           |

Authentication is provisioned-account only. Public registration remains disabled.

## Database

| Dependency  | Purpose                               |
| ----------- | ------------------------------------- |
| Drizzle ORM | Schema and typed data access          |
| Drizzle Kit | SQL migration generation              |
| `pg`        | PostgreSQL connection pool and driver |
| Zod         | Database environment validation       |

## UI package

| Dependency               | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| Radix Slot               | Accessible component composition             |
| Class Variance Authority | Typed component variants                     |
| `clsx`                   | Conditional class composition                |
| `tailwind-merge`         | Resolves conflicting Tailwind classes        |
| React                    | Shared component runtime and peer dependency |

The UI package contains shadcn-style source components; it is not a separately installed
binary component library.

## Infrastructure

| Dependency        | Purpose                                  |
| ----------------- | ---------------------------------------- |
| AWS SDK S3 client | S3-compatible storage client preparation |

Storage configuration exists, but business upload features are outside the current
project scope.

## Internal dependencies

Internal packages use the `workspace:*` range:

```text
@repo/api
@repo/auth
@repo/config
@repo/db
@repo/types
@repo/ui
```

Use `@repo/*` imports instead of cross-package relative paths.

## Dependency operations

Install the locked dependency graph:

```bash
bun install --frozen-lockfile
```

For local development after an intentional manifest change:

```bash
bun install
```

Add or remove a dependency from the workspace that imports it, not automatically from
the repository root. Run Bun from that workspace directory and review both the
`package.json` change and `bun.lock`.

Before accepting an update:

```bash
bun outdated
bun audit
bun check-types
bun lint
bun test:integration
bun run build
```

Update related framework packages together when required by their compatibility
documentation. Do not perform broad dependency upgrades as part of an unrelated feature
or bug fix.

## Lockfile policy

- Commit `bun.lock`.
- Do not edit `bun.lock` manually.
- Investigate unexpected lockfile-wide changes before committing.
- Docker and CI builds should use `bun install --frozen-lockfile`.
