import { defineConfig } from "drizzle-kit";

const localDatabaseUrl = "postgresql://app:replace-with-a-local-password@localhost:5433/app";
const databaseUrl = new URL(process.env.DATABASE_URL ?? localDatabaseUrl).toString();

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
