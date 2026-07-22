import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";

import * as schema from "./schema";

const databaseUrlSchema = z
  .string()
  .min(1)
  .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
    message: "DATABASE_URL must be a PostgreSQL connection URL",
  });

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  const url = databaseUrlSchema.parse(connectionString);
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  return { db, pool };
}

const databaseGlobal = globalThis as typeof globalThis & {
  __xChangeDatabase?: ReturnType<typeof createDatabase>;
};

export function getDatabase() {
  databaseGlobal.__xChangeDatabase ??= createDatabase();
  return databaseGlobal.__xChangeDatabase;
}

export type Database = ReturnType<typeof createDatabase>["db"];
