import { fileURLToPath } from "node:url";
import { z } from "zod";

const connectionString = new URL(z.url().parse(process.env.DATABASE_URL)).toString();
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
    connectionString,
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
