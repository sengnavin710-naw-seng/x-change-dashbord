import { z } from "zod";

import type { HealthStatus } from "@repo/types";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "./trpc";
import { dashboardRouter } from "./dashboard";
import { exchangeRatesRouter } from "./exchange-rates";
import { operationsRouter } from "./operations-router";

const healthStatusSchema = z.object({
  status: z.literal("ok"),
});

export const appRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  exchangeRates: exchangeRatesRouter,
  health: publicProcedure.output(healthStatusSchema).query((): HealthStatus => ({ status: "ok" })),
  operations: operationsRouter,
  viewer: protectedProcedure
    .output(
      z.object({
        email: z.email(),
        id: z.string(),
        name: z.string(),
      }),
    )
    .query(({ ctx }) => ({
      email: ctx.session.user.email,
      id: ctx.session.user.id,
      name: ctx.session.user.name,
    })),
});

export type AppRouter = typeof appRouter;
