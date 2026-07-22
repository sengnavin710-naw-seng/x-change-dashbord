import { createDatabase } from "./client";
import { migrateDatabase } from "./migrate";

const database = createDatabase();

try {
  await migrateDatabase(database.db);
  console.info("Database migrations applied.");
} finally {
  await database.pool.end();
}
