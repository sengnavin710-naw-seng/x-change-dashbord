import { Pool } from "pg";

import { account, createDatabase, session, user, verification } from "@repo/db";
import { migrateDatabase } from "@repo/db/migrate";

const defaultTestDatabaseUrl =
  "postgresql://app:replace-with-a-local-password@localhost:5433/app_test";

export async function prepareTestDatabase() {
  const connectionString = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
  const url = new URL(connectionString);
  const databaseName = url.pathname.slice(1);

  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !databaseName.endsWith("_test") ||
    !/^[a-zA-Z0-9_]+$/.test(databaseName)
  ) {
    throw new Error("Integration tests require a local PostgreSQL database ending in _test.");
  }

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

  const connection = createDatabase(connectionString);
  await migrateDatabase(connection.db);

  async function clean() {
    await connection.db.delete(session);
    await connection.db.delete(account);
    await connection.db.delete(verification);
    await connection.db.delete(user);
  }

  return { ...connection, clean };
}
