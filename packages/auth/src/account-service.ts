import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { account, session, user, type Database } from "@repo/db";

import type { Auth } from "./server";

const emailSchema = z.string().trim().toLowerCase().email();
const nameSchema = z.string().trim().min(1).max(120);

export const passwordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters.")
  .max(128, "Password must contain at most 128 characters.");

type AccountServiceErrorCode = "USER_ALREADY_EXISTS" | "USER_NOT_FOUND";

export class AccountServiceError extends Error {
  constructor(
    readonly code: AccountServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountServiceError";
  }
}

export function createAccountService(input: { auth: Auth; database: Database }) {
  const { auth, database } = input;

  async function findUserByEmail(rawEmail: string) {
    const email = emailSchema.parse(rawEmail);
    const [record] = await database.select().from(user).where(eq(user.email, email)).limit(1);
    return record;
  }

  async function requireUser(rawEmail: string) {
    const record = await findUserByEmail(rawEmail);

    if (!record) {
      throw new AccountServiceError("USER_NOT_FOUND", "No provisioned account uses this email.");
    }

    return record;
  }

  return {
    async provisionUser(values: { email: string; name: string; password: string }) {
      const email = emailSchema.parse(values.email);
      const name = nameSchema.parse(values.name);
      const password = passwordSchema.parse(values.password);

      if (await findUserByEmail(email)) {
        throw new AccountServiceError(
          "USER_ALREADY_EXISTS",
          "A provisioned account already uses this email.",
        );
      }

      await auth.api.signUpEmail({
        body: { email, name, password },
      });

      return requireUser(email);
    },

    async setPassword(rawEmail: string, rawPassword: string) {
      const record = await requireUser(rawEmail);
      const password = passwordSchema.parse(rawPassword);
      const passwordHash = await hashPassword(password);

      const updatedAccounts = await database.transaction(async (transaction) => {
        const updated = await transaction
          .update(account)
          .set({ password: passwordHash, updatedAt: new Date() })
          .where(and(eq(account.userId, record.id), eq(account.providerId, "credential")))
          .returning({ id: account.id });

        await transaction.delete(session).where(eq(session.userId, record.id));
        return updated;
      });

      if (updatedAccounts.length === 0) {
        throw new AccountServiceError(
          "USER_NOT_FOUND",
          "The account does not have email and password credentials.",
        );
      }

      return record;
    },

    async disableUser(rawEmail: string) {
      const record = await requireUser(rawEmail);

      await database.transaction(async (transaction) => {
        await transaction.update(user).set({ active: false }).where(eq(user.id, record.id));
        await transaction.delete(session).where(eq(session.userId, record.id));
      });

      return { ...record, active: false };
    },

    async enableUser(rawEmail: string) {
      const record = await requireUser(rawEmail);
      await database.update(user).set({ active: true }).where(eq(user.id, record.id));
      return { ...record, active: true };
    },

    async revokeUserSessions(rawEmail: string) {
      const record = await requireUser(rawEmail);
      const revoked = await database
        .delete(session)
        .where(eq(session.userId, record.id))
        .returning({ id: session.id });

      return { count: revoked.length, user: record };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
