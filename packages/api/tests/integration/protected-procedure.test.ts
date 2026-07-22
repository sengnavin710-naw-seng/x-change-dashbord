import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";

import type { TRPCContext } from "../../src/trpc";
import type { Database } from "@repo/db";

import { appRouter } from "../../src/root";

const now = new Date();

function context(session: TRPCContext["session"]): TRPCContext {
  return { database: {} as Database, headers: new Headers(), session };
}

describe("protected tRPC procedures", () => {
  test("rejects a request without an active session", async () => {
    const caller = appRouter.createCaller(context(null));

    try {
      await caller.viewer();
      throw new Error("Expected viewer to reject an unauthenticated request.");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });

  test("returns the viewer for an active session", async () => {
    const caller = appRouter.createCaller(
      context({
        session: {
          createdAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          id: "session-id",
          ipAddress: null,
          token: "session-token",
          updatedAt: now,
          userAgent: null,
          userId: "user-id",
        },
        user: {
          active: true,
          createdAt: now,
          email: "employee@example.com",
          emailVerified: false,
          id: "user-id",
          image: null,
          name: "Employee",
          updatedAt: now,
        },
      }),
    );

    await expect(caller.viewer()).resolves.toEqual({
      email: "employee@example.com",
      id: "user-id",
      name: "Employee",
    });
  });
});
