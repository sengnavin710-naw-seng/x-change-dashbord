import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";

import { authSchema, getDatabase, user as userTable, type Database } from "@repo/db";

const authEnvironmentSchema = z.object({
  baseURL: z.url(),
  secret: z.string().min(32),
});

export interface CreateAuthOptions {
  allowSignUp?: boolean;
  baseURL?: string;
  database?: Database;
  secret?: string;
}

export function createAuth(options: CreateAuthOptions = {}) {
  const environment = authEnvironmentSchema.parse({
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL,
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
  });
  const database = options.database ?? getDatabase().db;

  return betterAuth({
    appName: "X-Change",
    baseURL: environment.baseURL,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      autoSignIn: false,
      disableSignUp: !(options.allowSignUp ?? false),
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-in/email") {
          return;
        }

        const parsedEmail = z.string().trim().toLowerCase().email().safeParse(context.body?.email);
        if (!parsedEmail.success) {
          return;
        }

        const [record] = await database
          .select({ active: userTable.active })
          .from(userTable)
          .where(eq(userTable.email, parsedEmail.data))
          .limit(1);

        if (record && !record.active) {
          throw new APIError("FORBIDDEN", {
            message: "This account is disabled.",
          });
        }
      }),
    },
    secret: environment.secret,
    trustedOrigins: [environment.baseURL],
    user: {
      additionalFields: {
        active: {
          defaultValue: true,
          input: false,
          required: true,
          type: "boolean",
        },
      },
    },
  });
}

const authGlobal = globalThis as typeof globalThis & {
  __xChangeAuth?: ReturnType<typeof createAuth>;
};

export function getAuth() {
  authGlobal.__xChangeAuth ??= createAuth();
  return authGlobal.__xChangeAuth;
}

export async function getSession(headers: Headers) {
  const session = await getAuth().api.getSession({ headers });

  if (!session?.user.active) {
    return null;
  }

  return session;
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
