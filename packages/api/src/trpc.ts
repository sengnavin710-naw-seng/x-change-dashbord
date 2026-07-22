import { initTRPC, TRPCError } from "@trpc/server";

import { getSession, type AuthSession } from "@repo/auth";
import { getDatabase, type Database } from "@repo/db";

export interface TRPCContext {
  database: Database;
  headers: Headers;
  session: AuthSession | null;
}

export async function createTRPCContext(input: Pick<TRPCContext, "headers">): Promise<TRPCContext> {
  return {
    database: getDatabase().db,
    headers: input.headers,
    session: await getSession(input.headers),
  };
}

const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user.active) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  });
});
