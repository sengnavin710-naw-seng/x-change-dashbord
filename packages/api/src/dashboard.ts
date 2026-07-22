import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { balanceConfiguration, cashBankTransaction, exchangeTransaction, expense } from "@repo/db";

import { createTRPCRouter, protectedProcedure } from "./trpc";
import { addMoney } from "./operations";
import { effectiveTransactionAt } from "./transaction-time";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid calendar date");

const totalSchema = z.object({ value: z.string() });

function previousCalendarDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export const dashboardRouter = createTRPCRouter({
  today: protectedProcedure.input(z.object({ date: dateSchema })).query(async ({ ctx, input }) => {
    const monthStartDate = `${input.date.slice(0, 7)}-01`;
    const [configuration] = await ctx.database
      .select()
      .from(balanceConfiguration)
      .where(lte(balanceConfiguration.calculationStartDate, input.date))
      .orderBy(desc(balanceConfiguration.calculationStartDate))
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

    const [exchangeMovement] = configuration
      ? await ctx.database
          .select({
            mmk: sql<string>`coalesce(sum(case when ${exchangeTransaction.direction} = 'mmk-to-thb' then ${exchangeTransaction.sourceAmount} else -${exchangeTransaction.actualPayout} end), 0)::numeric(20, 4)::text`,
            thb: sql<string>`coalesce(sum(case when ${exchangeTransaction.direction} = 'thb-to-mmk' then ${exchangeTransaction.sourceAmount} else -${exchangeTransaction.actualPayout} end), 0)::numeric(20, 4)::text`,
          })
          .from(exchangeTransaction)
          .where(
            and(
              gte(exchangeTransaction.transactionDate, configuration.calculationStartDate),
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
        transactionAt: exchangeTransaction.transactionAt,
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
        transactionAt: cashBankTransaction.transactionAt,
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
        transactionAt: expense.transactionAt,
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

    const [monthlyExchangeProfit] = await ctx.database
      .select({
        value: sql<string>`coalesce(sum(${exchangeTransaction.formulaProfitThb}), 0)::numeric(20, 4)::text`,
      })
      .from(exchangeTransaction)
      .where(
        and(
          gte(exchangeTransaction.transactionDate, monthStartDate),
          lte(exchangeTransaction.transactionDate, input.date),
          isNull(exchangeTransaction.voidedAt),
        ),
      );
    const [monthlyCashBankFees] = await ctx.database
      .select({
        mmk: sql<string>`coalesce(sum(case when ${cashBankTransaction.currency} = 'MMK' then ${cashBankTransaction.feeAmount} else 0 end), 0)::numeric(20, 4)::text`,
        thb: sql<string>`coalesce(sum(case when ${cashBankTransaction.currency} = 'THB' then ${cashBankTransaction.feeAmount} else 0 end), 0)::numeric(20, 4)::text`,
      })
      .from(cashBankTransaction)
      .where(
        and(
          gte(cashBankTransaction.transactionDate, monthStartDate),
          lte(cashBankTransaction.transactionDate, input.date),
          isNull(cashBankTransaction.voidedAt),
        ),
      );

    const exchangeTotal = totalSchema.parse(exchangeProfit ?? { value: "0" }).value;
    const monthlyExchangeTotal = totalSchema.parse(monthlyExchangeProfit ?? { value: "0" }).value;

    return {
      balanceConfiguration: configuration
        ? {
            calculationStartDate: configuration.calculationStartDate,
            checkpointDate: previousCalendarDate(configuration.calculationStartDate),
            checkpointMmk: configuration.checkpointMmk,
            checkpointThb: configuration.checkpointThb,
            note: configuration.note,
            openingMmk: configuration.openingMmk,
            openingThb: configuration.openingThb,
          }
        : null,
      closingBalance: configuration
        ? {
            mmk: addMoney(configuration.checkpointMmk, exchangeMovement?.mmk ?? "0"),
            thb: addMoney(configuration.checkpointThb, exchangeMovement?.thb ?? "0"),
          }
        : null,
      date: input.date,
      profitThisMonth: {
        fromDate: monthStartDate,
        mmk: monthlyCashBankFees?.mmk ?? "0.0000",
        thb: addMoney(monthlyExchangeTotal, monthlyCashBankFees?.thb ?? "0.0000"),
        toDate: input.date,
      },
      recentTransactions: [
        ...recentExchanges.map((transaction) => ({
          ...transaction,
          transactionAt: transaction.transactionAt.toISOString(),
          type: "exchange" as const,
        })),
        ...recentCashBank.map((transaction) => ({
          ...transaction,
          transactionAt: effectiveTransactionAt(
            transaction.transactionDate,
            transaction.transactionAt,
            transaction.createdAt,
          ).toISOString(),
          type: "cash-bank" as const,
        })),
        ...recentExpenses.map((transaction) => ({
          ...transaction,
          transactionAt: effectiveTransactionAt(
            transaction.transactionDate,
            transaction.transactionAt,
            transaction.createdAt,
          ).toISOString(),
          type: "expense" as const,
        })),
      ]
        .sort((left, right) => Date.parse(right.transactionAt) - Date.parse(left.transactionAt))
        .slice(0, 8)
        .map((transaction) => ({
          ...transaction,
          createdAt: transaction.createdAt.toISOString(),
        })),
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
