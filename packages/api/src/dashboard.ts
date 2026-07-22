import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { cashBankTransaction, exchangeTransaction, expense, openingBalance } from "@repo/db";

import { createTRPCRouter, protectedProcedure } from "./trpc";
import { addMoney } from "./operations";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid calendar date");

const totalSchema = z.object({ value: z.string() });

export const dashboardRouter = createTRPCRouter({
  today: protectedProcedure.input(z.object({ date: dateSchema })).query(async ({ ctx, input }) => {
    const [opening] = await ctx.database
      .select()
      .from(openingBalance)
      .where(lte(openingBalance.effectiveDate, input.date))
      .orderBy(desc(openingBalance.effectiveDate))
      .limit(1);

    const [exchangeProfit] = await ctx.database
      .select({
        value: sql<string>`coalesce(sum(${exchangeTransaction.formulaProfitThb}), 0)::numeric(20, 4)::text`,
      })
      .from(exchangeTransaction)
      .where(
        and(
          eq(exchangeTransaction.transactionDate, input.date),
          isNull(exchangeTransaction.voidedAt),
        ),
      );

    const [exchangeMovement] = opening
      ? await ctx.database
          .select({
            mmk: sql<string>`coalesce(sum(case when ${exchangeTransaction.direction} = 'mmk-to-thb' then ${exchangeTransaction.sourceAmount} else -${exchangeTransaction.actualPayout} end), 0)::numeric(20, 4)::text`,
            thb: sql<string>`coalesce(sum(case when ${exchangeTransaction.direction} = 'thb-to-mmk' then ${exchangeTransaction.sourceAmount} else -${exchangeTransaction.actualPayout} end), 0)::numeric(20, 4)::text`,
          })
          .from(exchangeTransaction)
          .where(
            and(
              gte(exchangeTransaction.transactionDate, opening.effectiveDate),
              lte(exchangeTransaction.transactionDate, input.date),
              isNull(exchangeTransaction.voidedAt),
            ),
          )
      : [];

    const recentExchanges = await ctx.database
      .select({
        actualPayout: exchangeTransaction.actualPayout,
        createdAt: exchangeTransaction.createdAt,
        description: exchangeTransaction.description,
        direction: exchangeTransaction.direction,
        formulaProfitThb: exchangeTransaction.formulaProfitThb,
        id: exchangeTransaction.id,
        sourceAmount: exchangeTransaction.sourceAmount,
        transactionDate: exchangeTransaction.transactionDate,
      })
      .from(exchangeTransaction)
      .where(
        and(
          eq(exchangeTransaction.transactionDate, input.date),
          isNull(exchangeTransaction.voidedAt),
        ),
      )
      .orderBy(desc(exchangeTransaction.createdAt))
      .limit(8);
    const recentCashBank = await ctx.database
      .select({
        createdAt: cashBankTransaction.createdAt,
        currency: cashBankTransaction.currency,
        description: cashBankTransaction.description,
        direction: cashBankTransaction.direction,
        feeAmount: cashBankTransaction.feeAmount,
        id: cashBankTransaction.id,
        principalAmount: cashBankTransaction.principalAmount,
        transactionDate: cashBankTransaction.transactionDate,
      })
      .from(cashBankTransaction)
      .where(
        and(
          eq(cashBankTransaction.transactionDate, input.date),
          isNull(cashBankTransaction.voidedAt),
        ),
      )
      .orderBy(desc(cashBankTransaction.createdAt))
      .limit(8);
    const recentExpenses = await ctx.database
      .select({
        amount: expense.amount,
        createdAt: expense.createdAt,
        currency: expense.currency,
        description: expense.description,
        id: expense.id,
        transactionDate: expense.transactionDate,
      })
      .from(expense)
      .where(and(eq(expense.transactionDate, input.date), isNull(expense.voidedAt)))
      .orderBy(desc(expense.createdAt))
      .limit(8);
    const [cashBankFees] = await ctx.database
      .select({
        mmk: sql<string>`coalesce(sum(case when ${cashBankTransaction.currency} = 'MMK' then ${cashBankTransaction.feeAmount} else 0 end), 0)::numeric(20, 4)::text`,
        thb: sql<string>`coalesce(sum(case when ${cashBankTransaction.currency} = 'THB' then ${cashBankTransaction.feeAmount} else 0 end), 0)::numeric(20, 4)::text`,
      })
      .from(cashBankTransaction)
      .where(
        and(
          eq(cashBankTransaction.transactionDate, input.date),
          isNull(cashBankTransaction.voidedAt),
        ),
      );
    const [expenses] = await ctx.database
      .select({
        mmk: sql<string>`coalesce(sum(case when ${expense.currency} = 'MMK' then ${expense.amount} else 0 end), 0)::numeric(20, 4)::text`,
        thb: sql<string>`coalesce(sum(case when ${expense.currency} = 'THB' then ${expense.amount} else 0 end), 0)::numeric(20, 4)::text`,
      })
      .from(expense)
      .where(and(eq(expense.transactionDate, input.date), isNull(expense.voidedAt)));

    const exchangeTotal = totalSchema.parse(exchangeProfit ?? { value: "0" }).value;

    return {
      balance: opening
        ? {
            mmk: addMoney(opening.operationalMmk, exchangeMovement?.mmk ?? "0"),
            thb: addMoney(opening.operationalThb, exchangeMovement?.thb ?? "0"),
          }
        : null,
      date: input.date,
      openingBalance: opening
        ? {
            effectiveDate: opening.effectiveDate,
            operationalMmk: opening.operationalMmk,
            operationalThb: opening.operationalThb,
            reconciled: opening.reconciled,
            referenceMmk: opening.referenceMmk,
            referenceThb: opening.referenceThb,
          }
        : null,
      recentTransactions: [
        ...recentExchanges.map((transaction) => ({
          ...transaction,
          type: "exchange" as const,
        })),
        ...recentCashBank.map((transaction) => ({
          ...transaction,
          type: "cash-bank" as const,
        })),
        ...recentExpenses.map((transaction) => ({
          ...transaction,
          type: "expense" as const,
        })),
      ]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 8),
      totals: {
        cashBankFeeMmk: cashBankFees?.mmk ?? "0.0000",
        cashBankFeeThb: cashBankFees?.thb ?? "0.0000",
        exchangeFormulaProfitThb: exchangeTotal,
        expensesMmk: expenses?.mmk ?? "0.0000",
        expensesThb: expenses?.thb ?? "0.0000",
      },
    };
  }),
});
