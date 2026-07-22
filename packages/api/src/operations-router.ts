import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  balanceConfiguration,
  cashBankTransaction,
  exchangeRateVersion,
  exchangeTransaction,
  expense,
  recordRevision,
} from "@repo/db";

import { calculateCashBank, calculateExchange } from "./operations";
import { dateInYangon, effectiveTransactionAt } from "./transaction-time";
import { createTRPCRouter, protectedProcedure } from "./trpc";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid calendar date");
const moneySchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/);
const positiveMoneySchema = moneySchema.refine((value) => Number(value) > 0);
const positiveWholeMoneySchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => Number.isSafeInteger(Number(value)));
const rateSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/)
  .refine((value) => Number(value) > 0);
const nonNegativeRateSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid date and time.",
});

export const operationsRouter = createTRPCRouter({
  createCashBank: protectedProcedure
    .input(
      z.object({
        currency: z.enum(["THB", "MMK"]),
        description: z.string().trim().max(500).optional(),
        direction: z.enum(["bank-to-cash", "cash-to-bank"]),
        feeRate: rateSchema,
        principalAmount: positiveMoneySchema,
        transactionAt: dateTimeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const calculation = calculateCashBank(input);
      const transactionAt = new Date(input.transactionAt);

      return ctx.database.transaction(async (transaction) => {
        const [record] = await transaction
          .insert(cashBankTransaction)
          .values({
            bankIn: calculation.bankIn,
            bankOut: calculation.bankOut,
            cashIn: calculation.cashIn,
            cashOut: calculation.cashOut,
            createdBy: ctx.session.user.id,
            currency: input.currency,
            description: input.description,
            direction: input.direction,
            feeAmount: calculation.feeAmount,
            feeRate: input.feeRate,
            principalAmount: input.principalAmount,
            transactionAt,
            transactionDate: dateInYangon(transactionAt),
            updatedBy: ctx.session.user.id,
          })
          .returning();

        if (!record) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await transaction.insert(recordRevision).values({
          action: "create",
          actorUserId: ctx.session.user.id,
          after: record,
          entity: "cash-bank",
          entityId: record.id,
          reason: "Cash and bank transaction created",
        });

        return record;
      });
    }),
  createExchange: protectedProcedure
    .input(
      z
        .object({
          actualPayout: positiveWholeMoneySchema,
          description: z.string().trim().max(500).optional(),
          direction: z.enum(["thb-to-mmk", "mmk-to-thb"]),
          rateOverrideReason: z.string().trim().min(3).max(500).optional(),
          rateVersionId: z.uuid(),
          sourceAmount: positiveMoneySchema,
          spreadOverride: nonNegativeRateSchema.optional(),
          transactionAt: dateTimeSchema,
        })
        .superRefine((input, context) => {
          if (input.spreadOverride !== undefined && !input.rateOverrideReason) {
            context.addIssue({
              code: "custom",
              message: "A reason is required when overriding the spread.",
              path: ["rateOverrideReason"],
            });
          }
        }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.database.transaction(async (transaction) => {
        const transactionAt = new Date(input.transactionAt);
        const [selectedRate] = await transaction
          .select()
          .from(exchangeRateVersion)
          .where(eq(exchangeRateVersion.id, input.rateVersionId))
          .limit(1);
        const [activeRate] = await transaction
          .select()
          .from(exchangeRateVersion)
          .where(lte(exchangeRateVersion.effectiveAt, transactionAt))
          .orderBy(desc(exchangeRateVersion.effectiveAt), desc(exchangeRateVersion.createdAt))
          .limit(1);

        if (!activeRate) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No exchange rate is active at the transaction time.",
          });
        }
        if (!selectedRate || selectedRate.effectiveAt > transactionAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The selected rate is not valid." });
        }

        const staleRate = selectedRate.id !== activeRate.id;
        const rateOverridden = staleRate || input.spreadOverride !== undefined;
        if (rateOverridden && !input.rateOverrideReason) {
          throw new TRPCError({
            code: staleRate ? "CONFLICT" : "BAD_REQUEST",
            message: staleRate
              ? "The active exchange rate has changed. Review the new rate or keep the displayed rate with a reason."
              : "A reason is required when overriding the spread.",
          });
        }

        const defaultSpread =
          input.direction === "thb-to-mmk"
            ? selectedRate.thbToMmkSpread
            : selectedRate.mmkToThbSpread;
        const spread = input.spreadOverride ?? defaultSpread;
        const calculation = calculateExchange({
          actualPayout: input.actualPayout,
          baseRate: selectedRate.baseRate,
          direction: input.direction,
          sourceAmount: input.sourceAmount,
          spread,
        });
        const actualSettlementProfitThb = calculation.actualSettlementProfitThb;
        const settlementVarianceThb = calculation.settlementVarianceThb;
        if (actualSettlementProfitThb === null || settlementVarianceThb === null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Actual payout is required." });
        }

        const [record] = await transaction
          .insert(exchangeTransaction)
          .values({
            actualPayout: input.actualPayout,
            actualSettlementProfitThb,
            baseRate: selectedRate.baseRate,
            calculatedPayout: calculation.calculatedPayout,
            createdBy: ctx.session.user.id,
            description: input.description,
            direction: input.direction,
            exchangeRateVersionId: selectedRate.id,
            formulaProfitThb: calculation.formulaProfitThb,
            rateOverridden,
            rateOverrideReason: input.rateOverrideReason || null,
            settlementVarianceThb,
            sourceAmount: input.sourceAmount,
            spread,
            transactionAt,
            transactionDate: dateInYangon(transactionAt),
            updatedBy: ctx.session.user.id,
          })
          .returning();

        if (!record) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await transaction.insert(recordRevision).values({
          action: "create",
          actorUserId: ctx.session.user.id,
          after: record,
          entity: "exchange",
          entityId: record.id,
          reason: "Exchange transaction created",
        });

        return record;
      });
    }),
  createExpense: protectedProcedure
    .input(
      z.object({
        amount: positiveMoneySchema,
        currency: z.enum(["THB", "MMK"]),
        description: z.string().trim().min(1).max(500),
        transactionAt: dateTimeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const transactionAt = new Date(input.transactionAt);
      return ctx.database.transaction(async (transaction) => {
        const [record] = await transaction
          .insert(expense)
          .values({
            amount: input.amount,
            createdBy: ctx.session.user.id,
            currency: input.currency,
            description: input.description,
            transactionAt,
            transactionDate: dateInYangon(transactionAt),
            updatedBy: ctx.session.user.id,
          })
          .returning();

        if (!record) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await transaction.insert(recordRevision).values({
          action: "create",
          actorUserId: ctx.session.user.id,
          after: record,
          entity: "expense",
          entityId: record.id,
          reason: "Expense created",
        });

        return record;
      });
    }),
  saveBalanceConfiguration: protectedProcedure
    .input(
      z.object({
        calculationStartDate: dateSchema,
        checkpointMmk: moneySchema,
        checkpointThb: moneySchema,
        note: z.string().trim().max(500).optional(),
        openingMmk: moneySchema,
        openingThb: moneySchema,
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.database.transaction(async (transaction) => {
        const [before] = await transaction
          .select()
          .from(balanceConfiguration)
          .orderBy(
            desc(balanceConfiguration.calculationStartDate),
            desc(balanceConfiguration.createdAt),
          )
          .limit(1);

        const values = {
          calculationStartDate: input.calculationStartDate,
          checkpointMmk: input.checkpointMmk,
          checkpointThb: input.checkpointThb,
          note: input.note ?? null,
          openingMmk: input.openingMmk,
          openingThb: input.openingThb,
          updatedBy: ctx.session.user.id,
        };
        const [record] = before
          ? await transaction
              .update(balanceConfiguration)
              .set(values)
              .where(eq(balanceConfiguration.id, before.id))
              .returning()
          : await transaction
              .insert(balanceConfiguration)
              .values({ ...values, createdBy: ctx.session.user.id })
              .returning();

        if (!record) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await transaction.insert(recordRevision).values({
          action: before ? "update" : "create",
          actorUserId: ctx.session.user.id,
          after: record,
          before: before ?? null,
          entity: "opening-balance",
          entityId: record.id,
          reason:
            input.reason ||
            (before ? "Balance configuration updated" : "Balance configuration created"),
        });

        return record;
      });
    }),
  getExchange: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [record] = await ctx.database
        .select()
        .from(exchangeTransaction)
        .where(and(eq(exchangeTransaction.id, input.id), isNull(exchangeTransaction.voidedAt)))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exchange transaction not found." });
      }

      const [rateVersion] = record.exchangeRateVersionId
        ? await ctx.database
            .select()
            .from(exchangeRateVersion)
            .where(eq(exchangeRateVersion.id, record.exchangeRateVersionId))
            .limit(1)
        : [undefined];

      return {
        ...record,
        createdAt: record.createdAt.toISOString(),
        rateVersion: rateVersion
          ? {
              ...rateVersion,
              createdAt: rateVersion.createdAt.toISOString(),
              effectiveAt: rateVersion.effectiveAt.toISOString(),
            }
          : null,
        transactionAt: record.transactionAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        voidedAt: record.voidedAt?.toISOString() ?? null,
      };
    }),
  getCashBank: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [record] = await ctx.database
        .select()
        .from(cashBankTransaction)
        .where(and(eq(cashBankTransaction.id, input.id), isNull(cashBankTransaction.voidedAt)))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cash and bank transaction not found." });
      }

      return {
        ...record,
        createdAt: record.createdAt.toISOString(),
        transactionAt: effectiveTransactionAt(
          record.transactionDate,
          record.transactionAt,
          record.createdAt,
        ).toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        voidedAt: record.voidedAt?.toISOString() ?? null,
      };
    }),
  getExpense: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const [record] = await ctx.database
      .select()
      .from(expense)
      .where(and(eq(expense.id, input.id), isNull(expense.voidedAt)))
      .limit(1);

    if (!record) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
    }

    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      transactionAt: effectiveTransactionAt(
        record.transactionDate,
        record.transactionAt,
        record.createdAt,
      ).toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      voidedAt: record.voidedAt?.toISOString() ?? null,
    };
  }),
  allTransactions: protectedProcedure
    .input(
      z
        .object({
          currency: z.enum(["THB", "MMK"]).optional(),
          fromDate: dateSchema,
          order: z.enum(["newest", "oldest"]).default("newest"),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(50),
          toDate: dateSchema,
          type: z.enum(["exchange", "cash-bank", "expense"]).optional(),
        })
        .refine((input) => input.fromDate <= input.toDate, {
          message: "The start date must be before or equal to the end date.",
          path: ["fromDate"],
        }),
    )
    .query(async ({ ctx, input }) => {
      const includeExchange = !input.type || input.type === "exchange";
      const includeCashBank = !input.type || input.type === "cash-bank";
      const includeExpense = !input.type || input.type === "expense";

      const [exchangeRecords, cashBankRecords, expenseRecords] = await Promise.all([
        includeExchange
          ? ctx.database
              .select()
              .from(exchangeTransaction)
              .where(
                and(
                  gte(exchangeTransaction.transactionDate, input.fromDate),
                  lte(exchangeTransaction.transactionDate, input.toDate),
                  input.currency
                    ? eq(
                        exchangeTransaction.direction,
                        input.currency === "THB" ? "thb-to-mmk" : "mmk-to-thb",
                      )
                    : undefined,
                  isNull(exchangeTransaction.voidedAt),
                ),
              )
          : Promise.resolve([]),
        includeCashBank
          ? ctx.database
              .select()
              .from(cashBankTransaction)
              .where(
                and(
                  gte(cashBankTransaction.transactionDate, input.fromDate),
                  lte(cashBankTransaction.transactionDate, input.toDate),
                  input.currency ? eq(cashBankTransaction.currency, input.currency) : undefined,
                  isNull(cashBankTransaction.voidedAt),
                ),
              )
          : Promise.resolve([]),
        includeExpense
          ? ctx.database
              .select()
              .from(expense)
              .where(
                and(
                  gte(expense.transactionDate, input.fromDate),
                  lte(expense.transactionDate, input.toDate),
                  input.currency ? eq(expense.currency, input.currency) : undefined,
                  isNull(expense.voidedAt),
                ),
              )
          : Promise.resolve([]),
      ]);

      const items = [
        ...exchangeRecords.map((record) => ({
          amount: record.sourceAmount,
          currency: record.direction === "thb-to-mmk" ? ("THB" as const) : ("MMK" as const),
          description: record.description,
          direction: record.direction,
          id: record.id,
          profitAmount: record.formulaProfitThb,
          profitCurrency: "THB" as const,
          transactionAt: record.transactionAt.toISOString(),
          transactionDate: record.transactionDate,
          type: "exchange" as const,
        })),
        ...cashBankRecords.map((record) => ({
          amount: record.principalAmount,
          currency: record.currency,
          description: record.description,
          direction: record.direction,
          id: record.id,
          profitAmount: record.feeAmount,
          profitCurrency: record.currency,
          transactionAt: effectiveTransactionAt(
            record.transactionDate,
            record.transactionAt,
            record.createdAt,
          ).toISOString(),
          transactionDate: record.transactionDate,
          type: "cash-bank" as const,
        })),
        ...expenseRecords.map((record) => ({
          amount: record.amount,
          currency: record.currency,
          description: record.description,
          direction: null,
          id: record.id,
          profitAmount: null,
          profitCurrency: null,
          transactionAt: effectiveTransactionAt(
            record.transactionDate,
            record.transactionAt,
            record.createdAt,
          ).toISOString(),
          transactionDate: record.transactionDate,
          type: "expense" as const,
        })),
      ].sort((first, second) => {
        const difference = Date.parse(first.transactionAt) - Date.parse(second.transactionAt);
        if (difference !== 0) return input.order === "newest" ? -difference : difference;
        return `${first.type}-${first.id}`.localeCompare(`${second.type}-${second.id}`);
      });

      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
      const page = Math.min(input.page, totalPages);
      const start = (page - 1) * input.pageSize;

      return {
        items: items.slice(start, start + input.pageSize),
        page,
        pageSize: input.pageSize,
        total,
        totalPages,
      };
    }),
  list: protectedProcedure
    .input(
      z.object({
        date: dateSchema,
        type: z.enum(["exchange", "cash-bank", "expense"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.type === "exchange") {
        const records = await ctx.database
          .select()
          .from(exchangeTransaction)
          .where(
            and(
              eq(exchangeTransaction.transactionDate, input.date),
              isNull(exchangeTransaction.voidedAt),
            ),
          )
          .orderBy(desc(exchangeTransaction.createdAt))
          .limit(100);
        return records
          .map((record) => ({
            ...record,
            transactionAt: record.transactionAt.toISOString(),
            type: "exchange" as const,
          }))
          .sort(
            (first, second) => Date.parse(second.transactionAt) - Date.parse(first.transactionAt),
          );
      }

      if (input.type === "cash-bank") {
        const records = await ctx.database
          .select()
          .from(cashBankTransaction)
          .where(
            and(
              eq(cashBankTransaction.transactionDate, input.date),
              isNull(cashBankTransaction.voidedAt),
            ),
          )
          .orderBy(desc(cashBankTransaction.createdAt))
          .limit(100);
        return records
          .map((record) => ({
            ...record,
            transactionAt: effectiveTransactionAt(
              record.transactionDate,
              record.transactionAt,
              record.createdAt,
            ).toISOString(),
            type: "cash-bank" as const,
          }))
          .sort(
            (first, second) => Date.parse(second.transactionAt) - Date.parse(first.transactionAt),
          );
      }

      const records = await ctx.database
        .select()
        .from(expense)
        .where(and(eq(expense.transactionDate, input.date), isNull(expense.voidedAt)))
        .orderBy(desc(expense.createdAt))
        .limit(100);
      return records
        .map((record) => ({
          ...record,
          transactionAt: effectiveTransactionAt(
            record.transactionDate,
            record.transactionAt,
            record.createdAt,
          ).toISOString(),
          type: "expense" as const,
        }))
        .sort(
          (first, second) => Date.parse(second.transactionAt) - Date.parse(first.transactionAt),
        );
    }),
  revisionHistory: protectedProcedure
    .input(
      z.object({
        entity: z.enum(["opening-balance", "exchange", "exchange-rate", "cash-bank", "expense"]),
        entityId: z.uuid(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.database
        .select({
          action: recordRevision.action,
          createdAt: recordRevision.createdAt,
          reason: recordRevision.reason,
        })
        .from(recordRevision)
        .where(
          and(eq(recordRevision.entity, input.entity), eq(recordRevision.entityId, input.entityId)),
        )
        .orderBy(asc(recordRevision.createdAt)),
    ),
  updateExchange: protectedProcedure
    .input(
      z.object({
        actualPayout: positiveWholeMoneySchema,
        description: z.string().trim().max(500).optional(),
        direction: z.enum(["thb-to-mmk", "mmk-to-thb"]),
        id: z.uuid(),
        rateMode: z.enum(["preserve", "historical", "override"]),
        reason: z.string().trim().min(3).max(500),
        sourceAmount: positiveMoneySchema,
        spreadOverride: nonNegativeRateSchema.optional(),
        transactionAt: dateTimeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.database.transaction(async (transaction) => {
        const [before] = await transaction
          .select()
          .from(exchangeTransaction)
          .where(and(eq(exchangeTransaction.id, input.id), isNull(exchangeTransaction.voidedAt)))
          .limit(1);

        if (!before) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Exchange transaction not found." });
        }

        if (input.rateMode === "preserve" && input.direction !== before.direction) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reapply the historical rate when changing the exchange direction.",
          });
        }

        const transactionAt = new Date(input.transactionAt);
        const [preservedRate] = before.exchangeRateVersionId
          ? await transaction
              .select()
              .from(exchangeRateVersion)
              .where(eq(exchangeRateVersion.id, before.exchangeRateVersionId))
              .limit(1)
          : [undefined];
        const [historicalRate] =
          input.rateMode === "historical"
            ? await transaction
                .select()
                .from(exchangeRateVersion)
                .where(lte(exchangeRateVersion.effectiveAt, transactionAt))
                .orderBy(desc(exchangeRateVersion.effectiveAt), desc(exchangeRateVersion.createdAt))
                .limit(1)
            : [undefined];
        const selectedRate = input.rateMode === "historical" ? historicalRate : preservedRate;
        if (!selectedRate) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No exchange rate is available for this edit.",
          });
        }
        if (input.rateMode === "override" && input.spreadOverride === undefined) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the override spread." });
        }

        const defaultSpread =
          input.direction === "thb-to-mmk"
            ? selectedRate.thbToMmkSpread
            : selectedRate.mmkToThbSpread;
        const spread =
          input.rateMode === "preserve"
            ? before.spread
            : input.rateMode === "override"
              ? input.spreadOverride!
              : defaultSpread;
        const baseRate = input.rateMode === "preserve" ? before.baseRate : selectedRate.baseRate;
        const calculation = calculateExchange({
          actualPayout: input.actualPayout,
          baseRate,
          direction: input.direction,
          sourceAmount: input.sourceAmount,
          spread,
        });
        const actualSettlementProfitThb = calculation.actualSettlementProfitThb;
        const settlementVarianceThb = calculation.settlementVarianceThb;
        if (actualSettlementProfitThb === null || settlementVarianceThb === null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Actual payout is required." });
        }

        const [after] = await transaction
          .update(exchangeTransaction)
          .set({
            actualPayout: input.actualPayout,
            actualSettlementProfitThb,
            baseRate,
            calculatedPayout: calculation.calculatedPayout,
            description: input.description,
            direction: input.direction,
            exchangeRateVersionId: selectedRate.id,
            formulaProfitThb: calculation.formulaProfitThb,
            rateOverridden:
              input.rateMode === "preserve" ? before.rateOverridden : input.rateMode === "override",
            rateOverrideReason:
              input.rateMode === "preserve"
                ? before.rateOverrideReason
                : input.rateMode === "override"
                  ? input.reason
                  : null,
            settlementVarianceThb,
            sourceAmount: input.sourceAmount,
            spread,
            transactionAt,
            transactionDate: dateInYangon(transactionAt),
            updatedBy: ctx.session.user.id,
          })
          .where(eq(exchangeTransaction.id, input.id))
          .returning();

        if (!after) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await transaction.insert(recordRevision).values({
          action: "update",
          actorUserId: ctx.session.user.id,
          after,
          before,
          entity: "exchange",
          entityId: after.id,
          reason: input.reason,
        });

        return after;
      });
    }),
  updateCashBank: protectedProcedure
    .input(
      z.object({
        currency: z.enum(["THB", "MMK"]),
        description: z.string().trim().max(500).optional(),
        direction: z.enum(["bank-to-cash", "cash-to-bank"]),
        feeRate: rateSchema,
        id: z.uuid(),
        principalAmount: positiveMoneySchema,
        reason: z.string().trim().min(3).max(500),
        transactionAt: dateTimeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const calculation = calculateCashBank(input);
      const transactionAt = new Date(input.transactionAt);

      return ctx.database.transaction(async (transaction) => {
        const [before] = await transaction
          .select()
          .from(cashBankTransaction)
          .where(and(eq(cashBankTransaction.id, input.id), isNull(cashBankTransaction.voidedAt)))
          .limit(1);

        if (!before) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cash and bank transaction not found.",
          });
        }

        const [after] = await transaction
          .update(cashBankTransaction)
          .set({
            bankIn: calculation.bankIn,
            bankOut: calculation.bankOut,
            cashIn: calculation.cashIn,
            cashOut: calculation.cashOut,
            currency: input.currency,
            description: input.description,
            direction: input.direction,
            feeAmount: calculation.feeAmount,
            feeRate: input.feeRate,
            principalAmount: input.principalAmount,
            transactionAt,
            transactionDate: dateInYangon(transactionAt),
            updatedBy: ctx.session.user.id,
          })
          .where(eq(cashBankTransaction.id, input.id))
          .returning();

        if (!after) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await transaction.insert(recordRevision).values({
          action: "update",
          actorUserId: ctx.session.user.id,
          after,
          before,
          entity: "cash-bank",
          entityId: after.id,
          reason: input.reason,
        });

        return after;
      });
    }),
  updateExpense: protectedProcedure
    .input(
      z.object({
        amount: positiveMoneySchema,
        currency: z.enum(["THB", "MMK"]),
        description: z.string().trim().min(1).max(500),
        id: z.uuid(),
        reason: z.string().trim().min(3).max(500),
        transactionAt: dateTimeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const transactionAt = new Date(input.transactionAt);
      return ctx.database.transaction(async (transaction) => {
        const [before] = await transaction
          .select()
          .from(expense)
          .where(and(eq(expense.id, input.id), isNull(expense.voidedAt)))
          .limit(1);

        if (!before) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
        }

        const [after] = await transaction
          .update(expense)
          .set({
            amount: input.amount,
            currency: input.currency,
            description: input.description,
            transactionAt,
            transactionDate: dateInYangon(transactionAt),
            updatedBy: ctx.session.user.id,
          })
          .where(eq(expense.id, input.id))
          .returning();

        if (!after) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        await transaction.insert(recordRevision).values({
          action: "update",
          actorUserId: ctx.session.user.id,
          after,
          before,
          entity: "expense",
          entityId: after.id,
          reason: input.reason,
        });

        return after;
      });
    }),
});
