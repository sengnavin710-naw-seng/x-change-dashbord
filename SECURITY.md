# Security

This repository contains an internal operations dashboard. Security-sensitive values and
real business data must remain outside Git.

## Secrets

The following values are secrets or credentials:

- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- User passwords and session tokens

Store local values in `.env`, which is ignored by Git. Store staging and production
values in the hosting provider's encrypted environment-variable settings. Keep only
placeholder values in `.env.example`.

Never paste secrets into documentation, commits, screenshots, issue descriptions, chat
messages, build output, or command-line arguments. If a secret is exposed, rotate it
immediately and revoke affected sessions or credentials.

## Authentication

- Public registration is disabled.
- Accounts are created by the provisioning CLI.
- Passwords must contain at least 12 characters.
- Disabled accounts cannot sign in.
- Disabling an account or changing its password revokes existing sessions.
- Protected pages and tRPC procedures validate an active server-side session.
- `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` must contain only intended
  application origins.

Account-management commands are documented in
[docs/OPERATIONS.md](docs/OPERATIONS.md).

## Database access

- Use a separate database for local development, integration tests, staging, and
  production.
- Use pooled Neon connections for the deployed application when supported.
- Restrict database credentials to the minimum environments that need them.
- Do not run destructive SQL against a shared database without a verified backup and an
  explicit recovery plan.
- Apply schema changes through reviewed, committed migrations.

## Staging and production

Staging is not a safe place for unrestricted secrets or unnecessary real customer data.
Use a separate production database, Netlify site, auth secret, and storage credentials
before a production launch.

Code rollback does not automatically reverse a database migration. Database changes must
be backward-compatible or have a separately reviewed recovery procedure.

## Reporting a security issue

Do not open a public issue containing credentials or sensitive business data. Notify the
project owner privately with:

- The affected environment and route
- The time the issue occurred
- A description of the observed behavior
- Sanitized logs with secrets and personal data removed
