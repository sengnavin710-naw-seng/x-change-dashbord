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

const dashboardInputSchema = z
  .object({
    date: dateSchema,
    profitFromDate: dateSchema.optional(),
    profitToDate: dateSchema.optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.profitFromDate) !== Boolean(value.profitToDate)) {
      context.addIssue({
        code: "custom",
        message: "Profit start and end dates must be provided together",
        path: ["profitFromDate"],
      });
    }

    if (value.profitFromDate && value.profitToDate && value.profitFromDate > value.profitToDate) {
      context.addIssue({
        code: "custom",
        message: "Profit start date must be on or before the end date",
        path: ["profitFromDate"],
      });
    }
  });

function previousCalendarDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export const dashboardRouter = createTRPCRouter({
  today: protectedProcedure.input(dashboardInputSchema).query(async ({ ctx, input }) => {
    const monthStartDate = `${input.date.slice(0, 7)}-01`;
    const profitFromDate = input.profitFromDate ?? monthStartDate;
    const profitToDate = input.profitToDate ?? input.date;
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

    const latestExchanges = await ctx.database
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
      .where(isNull(exchangeTransaction.voidedAt))
      .orderBy(desc(exchangeTransaction.transactionAt), desc(exchangeTransaction.createdAt))
      .limit(8);
    const latestCashBank = await ctx.database
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
      .where(isNull(cashBankTransaction.voidedAt))
      .orderBy(
        desc(cashBankTransaction.transactionDate),
        desc(cashBankTransaction.transactionAt),
        desc(cashBankTransaction.createdAt),
      )
      .limit(8);
    const latestExpenses = await ctx.database
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
      .where(isNull(expense.voidedAt))
      .orderBy(desc(expense.transactionDate), desc(expense.transactionAt), desc(expense.createdAt))
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

    const [rangeExchangeProfit] = await ctx.database
      .select({
        value: sql<string>`coalesce(sum(${exchangeTransaction.formulaProfitThb}), 0)::numeric(20, 4)::text`,
      })
      .from(exchangeTransaction)
      .where(
        and(
          gte(exchangeTransaction.transactionDate, profitFromDate),
          lte(exchangeTransaction.transactionDate, profitToDate),
          isNull(exchangeTransaction.voidedAt),
        ),
      );
    const [rangeCashBankFees] = await ctx.database
      .select({
        mmk: sql<string>`coalesce(sum(case when ${cashBankTransaction.currency} = 'MMK' then ${cashBankTransaction.feeAmount} else 0 end), 0)::numeric(20, 4)::text`,
        thb: sql<string>`coalesce(sum(case when ${cashBankTransaction.currency} = 'THB' then ${cashBankTransaction.feeAmount} else 0 end), 0)::numeric(20, 4)::text`,
      })
      .from(cashBankTransaction)
      .where(
        and(
          gte(cashBankTransaction.transactionDate, profitFromDate),
          lte(cashBankTransaction.transactionDate, profitToDate),
          isNull(cashBankTransaction.voidedAt),
        ),
      );

    const exchangeTotal = totalSchema.parse(exchangeProfit ?? { value: "0" }).value;
    const rangeExchangeTotal = totalSchema.parse(rangeExchangeProfit ?? { value: "0" }).value;

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
      profitForRange: {
        fromDate: profitFromDate,
        mmk: rangeCashBankFees?.mmk ?? "0.0000",
        thb: addMoney(rangeExchangeTotal, rangeCashBankFees?.thb ?? "0.0000"),
        toDate: profitToDate,
      },
      latestTransactions: [
        ...latestExchanges.map((transaction) => ({
          ...transaction,
          transactionAt: transaction.transactionAt.toISOString(),
          type: "exchange" as const,
        })),
        ...latestCashBank.map((transaction) => ({
          ...transaction,
          transactionAt: effectiveTransactionAt(
            transaction.transactionDate,
            transaction.transactionAt,
            transaction.createdAt,
          ).toISOString(),
          type: "cash-bank" as const,
        })),
        ...latestExpenses.map((transaction) => ({
          ...transaction,
          transactionAt: effectiveTransactionAt(
            transaction.transactionDate,
            transaction.transactionAt,
            transaction.createdAt,
          ).toISOString(),
          type: "expense" as const,
        })),
      ]
        .sort((left, right) => {
          const difference = Date.parse(right.transactionAt) - Date.parse(left.transactionAt);
          if (difference !== 0) return difference;
          return `${left.type}-${left.id}`.localeCompare(`${right.type}-${right.id}`);
        })
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
