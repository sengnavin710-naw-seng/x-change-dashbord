# Deployment

## Current environments

| Environment | Web                                                   | Database          | Purpose                                 |
| ----------- | ----------------------------------------------------- | ----------------- | --------------------------------------- |
| Local       | Next.js on `http://localhost:3000`                    | Docker PostgreSQL | Development                             |
| Staging     | Netlify at `https://shwe-lin-pan-staging.netlify.app` | Neon PostgreSQL   | Client review and deployment validation |
| Production  | Not configured                                        | Not configured    | Future production launch                |

Staging resources must not be reused as production resources.

## Staging configuration

The Netlify project is connected to the Git repository and deploys the `main` branch.

```text
Repository base: repository root
Project to deploy: apps/web
Build command: bun run db:migrate && turbo run build --filter @repo/web
Publish directory: apps/web/.next
```

Netlify's Next.js runtime handles the server-rendered application and functions.

## Required environment variables

Set values through Netlify's environment-variable UI. Do not commit or document the
values.

| Variable                      | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `DATABASE_URL`                | Pooled Neon PostgreSQL connection string  |
| `BETTER_AUTH_SECRET`          | Random secret with at least 32 characters |
| `BETTER_AUTH_URL`             | Exact staging application origin          |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated allowed browser origins   |
| `NEXT_PUBLIC_APP_URL`         | Exact public staging application origin   |

For the current staging domain, the three URL/origin settings use:

```text
https://shwe-lin-pan-staging.netlify.app
```

Optional S3 preparation variables are:

```text
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE
```

Do not reuse the local `.env` database URL or local Better Auth URL in Netlify.

## Automatic deployment

1. Run the required checks locally.
2. Commit the intended changes.
3. Push `main` to GitHub.
4. Netlify retrieves the latest commit.
5. `bun db:migrate` applies pending committed migrations to Neon.
6. Netlify builds and publishes the Next.js application.
7. Verify the login page, protected Dashboard, database queries, and mobile layout.

The Deploys page should show the expected commit SHA and finish with `Published`.

## Manual retry

From the Netlify project:

1. Open **Deploys**.
2. Select **Trigger deploy**.
3. Choose **Deploy site** or **Retry with latest branch commit**.
4. If a cache problem is suspected, use **Retry without cache with latest branch
   commit**.

Do not publish an older deploy when the database requires a newer migration.

## First staging account

After migrations succeed, connect the provisioning CLI to the staging environment and
run:

```bash
bun auth:user:create --email employee@company.com --name "Employee Name"
```

Provide `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and trusted origins to
the process through a secure local method. The password prompt is hidden. Do not pass a
password as a command-line argument.

See [OPERATIONS.md](OPERATIONS.md) for account lifecycle commands.

## Post-deploy smoke test

- The root route redirects to the expected login or dashboard route.
- English/Burmese language selection works.
- A provisioned active user can sign in.
- The Dashboard loads without a server error.
- Rate and Balance Setup pages can read the staging database.
- Creating each transaction type refreshes totals and Latest Transactions.
- Editing or voiding a record recalculates affected summaries.
- Netlify Function logs contain no new database or authentication errors.

## Failure diagnosis

### Build fails during migration

Check:

- `DATABASE_URL` is present and is a complete Neon connection string.
- The Neon compute and branch are available.
- Generated migrations are committed.
- The failing migration has not been partially edited or previously applied under a
  different name.

### Sign in fails

Check:

- The account exists in the same Neon database used by Netlify.
- The account is active.
- The CLI and Netlify used the same current `BETTER_AUTH_SECRET` when applicable.
- Auth URL and trusted origins exactly match the staging HTTPS origin.

### Dashboard fails after sign in

Open **Logs & metrics → Functions → Next.js Server Handler** and inspect the newest error.
A successful login followed by a failed table query usually means the required database
migration did not run.

Sanitize screenshots and logs before sharing them.

## Production checklist

Before production:

- Create a separate Netlify project and Neon project or production branch.
- Generate a new Better Auth secret.
- Configure a production domain and trusted origins.
- Establish tested backup and restore procedures.
- Apply migrations before opening access.
- Provision only approved accounts.
- Complete security, integration, mobile, and Excel-parity acceptance tests.
- Document rollback ownership and incident contacts.

Code rollback does not roll back database migrations.
