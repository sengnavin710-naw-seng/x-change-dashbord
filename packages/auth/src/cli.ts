import { createDatabase } from "@repo/db";

import { createAccountService, passwordSchema } from "./account-service";
import { promptHidden, promptText, readPasswordFromStdin } from "./prompts";
import { createAuth } from "./server";

const [command, ...args] = process.argv.slice(2);

function option(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(name: string) {
  return args.includes(name);
}

async function emailInput() {
  return option("--email") ?? promptText("Email: ");
}

async function passwordInput(confirm: boolean) {
  const password = hasFlag("--password-stdin")
    ? await readPasswordFromStdin()
    : await promptHidden("Password: ");

  passwordSchema.parse(password);

  if (confirm && !hasFlag("--password-stdin")) {
    const confirmation = await promptHidden("Confirm password: ");
    if (password !== confirmation) {
      throw new Error("Passwords do not match.");
    }
  }

  return password;
}

function printUsage() {
  console.info(`Usage:
  bun auth:user:create [--email user@company.com] [--name "Name"] [--password-stdin]
  bun auth:user:set-password [--email user@company.com] [--password-stdin]
  bun auth:user:disable [--email user@company.com]
  bun auth:user:enable [--email user@company.com]
  bun auth:user:revoke-sessions [--email user@company.com]`);
}

if (!command || hasFlag("--help")) {
  printUsage();
  process.exitCode = command ? 0 : 1;
} else {
  const connection = createDatabase();
  const auth = createAuth({ allowSignUp: true, database: connection.db });
  const accounts = createAccountService({ auth, database: connection.db });

  try {
    if (command === "create") {
      const email = await emailInput();
      const name = option("--name") ?? (await promptText("Name: "));
      const password = await passwordInput(true);
      const provisioned = await accounts.provisionUser({ email, name, password });
      console.info(`Provisioned ${provisioned.email}.`);
    } else if (command === "set-password") {
      const email = await emailInput();
      const password = await passwordInput(true);
      const updated = await accounts.setPassword(email, password);
      console.info(`Updated password and revoked sessions for ${updated.email}.`);
    } else if (command === "disable") {
      const disabled = await accounts.disableUser(await emailInput());
      console.info(`Disabled ${disabled.email} and revoked all sessions.`);
    } else if (command === "enable") {
      const enabled = await accounts.enableUser(await emailInput());
      console.info(`Enabled ${enabled.email}.`);
    } else if (command === "revoke-sessions") {
      const result = await accounts.revokeUserSessions(await emailInput());
      console.info(`Revoked ${result.count} session(s) for ${result.user.email}.`);
    } else {
      printUsage();
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown account operation error.";
    console.error(`Account operation failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await connection.pool.end();
  }
}
