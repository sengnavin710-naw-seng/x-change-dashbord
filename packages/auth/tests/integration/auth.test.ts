import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { count } from "drizzle-orm";

import { session } from "@repo/db";

import { createAccountService } from "../../src/account-service";
import { createAuth, type Auth } from "../../src/server";
import { prepareTestDatabase } from "./test-database";

const testSecret = "integration-test-secret-that-is-at-least-32-characters-long";
const baseURL = "http://localhost:3000";

setDefaultTimeout(60_000);

let testDatabase: Awaited<ReturnType<typeof prepareTestDatabase>>;

beforeAll(async () => {
  testDatabase = await prepareTestDatabase();
});

beforeEach(async () => {
  await testDatabase.clean();
});

afterAll(async () => {
  if (!testDatabase) {
    return;
  }

  await testDatabase.clean();
  await testDatabase.pool.end();
});

function setup(allowSignUp = true) {
  const auth = createAuth({
    allowSignUp,
    baseURL,
    database: testDatabase.db,
    secret: testSecret,
  });
  const accounts = createAccountService({ auth, database: testDatabase.db });
  return { accounts, auth };
}

function authRequest(
  auth: Auth,
  path: "/sign-in/email" | "/sign-up/email",
  body: Record<string, unknown>,
) {
  return auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
}

function signIn(auth: Auth, email: string, password: string) {
  return authRequest(auth, "/sign-in/email", { email, password });
}

describe("provisioned account authentication", () => {
  test("public runtime configuration rejects sign-up", async () => {
    const { auth } = setup(false);

    const response = await authRequest(auth, "/sign-up/email", {
      email: "not-provisioned@example.com",
      name: "Not Provisioned",
      password: "correct-horse-battery-staple",
    });

    expect(response.status).toBe(400);
  });

  test("a provisioned user can sign in with the assigned credentials", async () => {
    const { accounts, auth } = setup();

    await accounts.provisionUser({
      email: "employee@example.com",
      name: "Employee",
      password: "correct-horse-battery-staple",
    });

    const response = await signIn(auth, "employee@example.com", "correct-horse-battery-staple");

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token");
  });

  test("disabling a user revokes sessions and blocks the next sign-in", async () => {
    const { accounts, auth } = setup();

    await accounts.provisionUser({
      email: "disabled@example.com",
      name: "Disabled Employee",
      password: "correct-horse-battery-staple",
    });
    await signIn(auth, "disabled@example.com", "correct-horse-battery-staple");

    await accounts.disableUser("disabled@example.com");

    const [sessionCount] = await testDatabase.db.select({ value: count() }).from(session);
    expect(sessionCount?.value).toBe(0);
    const response = await signIn(auth, "disabled@example.com", "correct-horse-battery-staple");
    expect(response.status).toBe(403);
  });

  test("changing a password revokes sessions and replaces the old credential", async () => {
    const { accounts, auth } = setup();

    await accounts.provisionUser({
      email: "password@example.com",
      name: "Password Employee",
      password: "correct-horse-battery-staple",
    });
    await signIn(auth, "password@example.com", "correct-horse-battery-staple");

    await accounts.setPassword("password@example.com", "new-correct-horse-battery-staple");

    const [sessionCount] = await testDatabase.db.select({ value: count() }).from(session);
    expect(sessionCount?.value).toBe(0);
    const oldPasswordResponse = await signIn(
      auth,
      "password@example.com",
      "correct-horse-battery-staple",
    );
    expect(oldPasswordResponse.status).toBe(401);

    const newPasswordResponse = await signIn(
      auth,
      "password@example.com",
      "new-correct-horse-battery-staple",
    );
    expect(newPasswordResponse.status).toBe(200);
  });

  test("revoking sessions leaves the account enabled", async () => {
    const { accounts, auth } = setup();

    await accounts.provisionUser({
      email: "sessions@example.com",
      name: "Sessions Employee",
      password: "correct-horse-battery-staple",
    });
    await signIn(auth, "sessions@example.com", "correct-horse-battery-staple");

    const revoked = await accounts.revokeUserSessions("sessions@example.com");
    expect(revoked.count).toBe(1);

    const response = await signIn(auth, "sessions@example.com", "correct-horse-battery-staple");
    expect(response.status).toBe(200);
  });
});
