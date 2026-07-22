import { desc, eq, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { exchangeRateVersion, recordRevision, user } from "@repo/db";

import { calculateExchangeRateConfiguration, calculateExchangeRateQuote } from "./operations";
import { createTRPCRouter, protectedProcedure } from "./trpc";

const rateSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/);
const positiveRateSchema = rateSchema.refine((value) => Number(value) > 0);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid date and time.",
});

function serializeRate(
  rate: typeof exchangeRateVersion.$inferSelect,
  createdByName?: string | null,
) {
  return {
    ...rate,
    createdAt: rate.createdAt.toISOString(),
    createdByName: createdByName ?? null,
    effectiveAt: rate.effectiveAt.toISOString(),
    ...calculateExchangeRateQuote(rate),
  };
}

export const exchangeRatesRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        baseRate: positiveRateSchema,
        effectiveAt: dateTimeSchema,
        mmkToThbBuyingRate: positiveRateSchema,
        note: z.string().trim().max(500).optional(),
        thbToMmkSellingRate: positiveRateSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let configuration: ReturnType<typeof calculateExchangeRateConfiguration>;
      try {
        configuration = calculateExchangeRateConfiguration(input);
      } catch (cause) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: cause instanceof Error ? cause.message : "The exchange rates are invalid.",
        });
      }
      const effectiveAt = new Date(input.effectiveAt);
      if (effectiveAt.getTime() > Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The exchange rate cannot start in the future.",
        });
      }

      return ctx.database.transaction(async (transaction) => {
        const [rate] = await transaction
          .insert(exchangeRateVersion)
          .values({
            baseRate: input.baseRate,
            createdBy: ctx.session.user.id,
            effectiveAt,
            mmkToThbSpread: configuration.mmkToThbSpread,
            note: input.note || null,
            thbToMmkSpread: configuration.thbToMmkSpread,
          })
          .onConflictDoNothing()
          .returning();

        if (!rate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A rate version already starts at this exact time.",
          });
        }

        await transaction.insert(recordRevision).values({
          action: "create",
          actorUserId: ctx.session.user.id,
          after: rate,
          entity: "exchange-rate",
          entityId: rate.id,
          reason: input.note || "Exchange rate version created",
        });

        return serializeRate(rate, ctx.session.user.name);
      });
    }),
  current: protectedProcedure
    .input(z.object({ at: dateTimeSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const at = new Date(input?.at ?? Date.now());
      const [rate] = await ctx.database
        .select()
        .from(exchangeRateVersion)
        .where(lte(exchangeRateVersion.effectiveAt, at))
        .orderBy(desc(exchangeRateVersion.effectiveAt), desc(exchangeRateVersion.createdAt))
        .limit(1);

      return rate ? serializeRate(rate) : null;
    }),
  history: protectedProcedure.query(async ({ ctx }) => {
    const rates = await ctx.database
      .select({
        createdByName: user.name,
        rate: exchangeRateVersion,
      })
      .from(exchangeRateVersion)
      .leftJoin(user, eq(exchangeRateVersion.createdBy, user.id))
      .orderBy(desc(exchangeRateVersion.effectiveAt), desc(exchangeRateVersion.createdAt))
      .limit(100);

    return rates.map(({ createdByName, rate }) => serializeRate(rate, createdByName));
  }),
});
