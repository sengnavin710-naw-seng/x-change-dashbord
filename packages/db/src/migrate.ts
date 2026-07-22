import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import type { Database } from "./client";

const defaultMigrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export function migrateDatabase(database: Database, migrationsFolder = defaultMigrationsFolder) {
  return migrate(database, { migrationsFolder });
}
