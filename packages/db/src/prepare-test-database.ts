import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const testDatabaseUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test");
}, "TEST_DATABASE_URL must point to a local database ending in _test.");

const connectionString = testDatabaseUrlSchema.parse(process.env.TEST_DATABASE_URL);
const apiConnectionUrl = new URL(connectionString);
apiConnectionUrl.pathname = `/${apiConnectionUrl.pathname.slice(1).replace(/_test$/, "_api_test")}`;

for (const testConnectionString of [connectionString, apiConnectionUrl.toString()]) {
  const url = new URL(testConnectionString);
  const databaseName = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });

  try {
    const existing = await adminPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_database where datname = $1) as exists",
      [databaseName],
    );

    if (!existing.rows[0]?.exists) {
      await adminPool.query(`create database "${databaseName}"`);
    }
  } finally {
    await adminPool.end();
  }

  const child = Bun.spawn(
    [
      "bunx",
      "drizzle-kit",
      "push",
      "--dialect",
      "postgresql",
      "--schema",
      "./src/schema.ts",
      "--url",
      testConnectionString,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stderr: "inherit",
      stdout: "inherit",
    },
  );

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
