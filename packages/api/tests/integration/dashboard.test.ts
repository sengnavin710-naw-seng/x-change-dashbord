import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
  cashBankTransaction,
  createDatabase,
  exchangeRateVersion,
  exchangeTransaction,
  expense,
  balanceConfiguration,
  recordRevision,
  user,
} from "@repo/db";

import type { TRPCContext } from "../../src/trpc";

import { appRouter } from "../../src/root";

const now = new Date();
let connection: ReturnType<typeof createDatabase>;

beforeAll(() => {
  const url = new URL(String(process.env.TEST_DATABASE_URL));
  url.pathname = `/${url.pathname.slice(1).replace(/_test$/, "_api_test")}`;
  connection = createDatabase(url.toString());
});

afterAll(async () => {
  await connection.pool.end();
});

beforeEach(async () => {
  await connection.db.delete(recordRevision);
  await connection.db.delete(cashBankTransaction);
  await connection.db.delete(exchangeTransaction);
  await connection.db.delete(exchangeRateVersion);
  await connection.db.delete(expense);
  await connection.db.delete(balanceConfiguration);
  await connection.db.delete(user);
  await connection.db.insert(user).values({
    active: true,
    email: "employee@example.com",
    id: "user-id",
    name: "Employee",
  });
});

function activeContext(): TRPCContext {
  return {
    database: connection.db,
    headers: new Headers(),
    session: {
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
    },
  };
}

describe("today dashboard", () => {
  test("stores the selected date and time for a Cash to Bank entry", async () => {
    const caller = appRouter.createCaller(activeContext());

    const created = await caller.operations.createCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "100000",
      transactionAt: "2026-07-02T14:35:00+06:30",
    });

    const stored = await caller.operations.getCashBank({ id: created.id });
    expect(stored.transactionDate).toBe("2026-07-02");
    expect(stored.transactionAt).toBe("2026-07-02T08:05:00.000Z");

    await caller.operations.updateCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      id: created.id,
      principalAmount: "100000",
      reason: "Corrected transaction time",
      transactionAt: "2026-07-01T16:10:00+06:30",
    });
    const updated = await caller.operations.getCashBank({ id: created.id });
    expect(updated.transactionDate).toBe("2026-07-01");
    expect(updated.transactionAt).toBe("2026-07-01T09:40:00.000Z");
  });

  test("stores the selected date and time for an expense", async () => {
    const caller = appRouter.createCaller(activeContext());

    const created = await caller.operations.createExpense({
      amount: "1500",
      currency: "THB",
      description: "Office supplies",
      transactionAt: "2026-07-03T09:20:00+06:30",
    });

    const stored = await caller.operations.getExpense({ id: created.id });
    expect(stored.transactionDate).toBe("2026-07-03");
    expect(stored.transactionAt).toBe("2026-07-03T02:50:00.000Z");
  });

  test("returns all transaction types in transaction-time order", async () => {
    const caller = appRouter.createCaller(activeContext());
    const rate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-01T00:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    const expenseRecord = await caller.operations.createExpense({
      amount: "500",
      currency: "THB",
      description: "Breakfast",
      transactionAt: "2026-07-04T08:00:00+06:30",
    });
    const exchange = await caller.operations.createExchange({
      actualPayout: "12900",
      direction: "thb-to-mmk",
      rateVersionId: rate.id,
      sourceAmount: "100",
      transactionAt: "2026-07-04T09:00:00+06:30",
    });
    const cashBank = await caller.operations.createCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "100000",
      transactionAt: "2026-07-04T10:00:00+06:30",
    });

    const result = await caller.operations.allTransactions({
      fromDate: "2026-07-04",
      order: "newest",
      page: 1,
      pageSize: 20,
      toDate: "2026-07-04",
    });

    expect(result.items.map(({ id, type }) => ({ id, type }))).toEqual([
      { id: cashBank.id, type: "cash-bank" },
      { id: exchange.id, type: "exchange" },
      { id: expenseRecord.id, type: "expense" },
    ]);
    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
  });

  test("filters the transaction timeline and paginates the result", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.createCashBank({
      currency: "THB",
      direction: "bank-to-cash",
      feeRate: "0.01",
      principalAmount: "1000",
      transactionAt: "2026-07-05T08:00:00+06:30",
    });
    await caller.operations.createCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "100000",
      transactionAt: "2026-07-05T09:00:00+06:30",
    });
    await caller.operations.createCashBank({
      currency: "THB",
      direction: "cash-to-bank",
      feeRate: "0.02",
      principalAmount: "2000",
      transactionAt: "2026-07-05T10:00:00+06:30",
    });
    await caller.operations.createExpense({
      amount: "500",
      currency: "THB",
      description: "Excluded by type",
      transactionAt: "2026-07-05T11:00:00+06:30",
    });

    const firstPage = await caller.operations.allTransactions({
      currency: "THB",
      fromDate: "2026-07-05",
      order: "oldest",
      page: 1,
      pageSize: 1,
      toDate: "2026-07-05",
      type: "cash-bank",
    });
    const secondPage = await caller.operations.allTransactions({
      currency: "THB",
      fromDate: "2026-07-05",
      order: "oldest",
      page: 2,
      pageSize: 1,
      toDate: "2026-07-05",
      type: "cash-bank",
    });

    expect(firstPage).toMatchObject({ page: 1, total: 2, totalPages: 2 });
    expect(firstPage.items[0]?.amount).toBe("1000.0000");
    expect(secondPage.items[0]?.amount).toBe("2000.0000");
  });

  test("shows a stable date and fallback time for a legacy transaction", async () => {
    const caller = appRouter.createCaller(activeContext());
    const createdAt = new Date("2026-07-10T02:30:00.000Z");
    await connection.db.insert(expense).values({
      amount: "500",
      createdAt,
      createdBy: "user-id",
      currency: "THB",
      description: "Legacy expense",
      transactionDate: "2026-07-06",
      updatedAt: createdAt,
      updatedBy: "user-id",
    });

    const result = await caller.operations.allTransactions({
      fromDate: "2026-07-06",
      page: 1,
      pageSize: 20,
      toDate: "2026-07-06",
    });

    expect(result.items[0]?.transactionAt).toBe("2026-07-06T02:30:00.000Z");
  });

  test("returns an honest empty state before an opening balance is configured", async () => {
    const caller = appRouter.createCaller(activeContext());

    await expect(caller.dashboard.today({ date: "2026-07-22" })).resolves.toEqual({
      balanceConfiguration: null,
      closingBalance: null,
      date: "2026-07-22",
      profitThisMonth: {
        fromDate: "2026-07-01",
        mmk: "0.0000",
        thb: "0.0000",
        toDate: "2026-07-22",
      },
      recentTransactions: [],
      totals: {
        cashBankFeeMmk: "0.0000",
        cashBankFeeThb: "0.0000",
        exchangeFormulaProfitThb: "0.0000",
        expensesMmk: "0.0000",
        expensesThb: "0.0000",
      },
    });
  });

  test("keeps Opening Balance as reference and uses the previous Closing Balance as the calculation checkpoint", async () => {
    const caller = appRouter.createCaller(activeContext());

    await caller.operations.saveBalanceConfiguration({
      calculationStartDate: "2026-07-01",
      checkpointMmk: "17407355",
      checkpointThb: "128200",
      note: "Imported from the Excel opening and June closing figures.",
      openingMmk: "5918129",
      openingThb: "235299",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-22" });
    expect(dashboard.balanceConfiguration).toEqual({
      calculationStartDate: "2026-07-01",
      checkpointDate: "2026-06-30",
      checkpointMmk: "17407355.0000",
      checkpointThb: "128200.0000",
      note: "Imported from the Excel opening and June closing figures.",
      openingMmk: "5918129.0000",
      openingThb: "235299.0000",
    });
    expect(dashboard.closingBalance).toEqual({
      mmk: "17407355.0000",
      thb: "128200.0000",
    });
  });

  test("updates the balance checkpoint and preserves the edit reason", async () => {
    const caller = appRouter.createCaller(activeContext());
    const created = await caller.operations.saveBalanceConfiguration({
      calculationStartDate: "2026-07-01",
      checkpointMmk: "17407355",
      checkpointThb: "128200",
      openingMmk: "5918129",
      openingThb: "235299",
    });

    const updated = await caller.operations.saveBalanceConfiguration({
      calculationStartDate: "2026-07-01",
      checkpointMmk: "17407400",
      checkpointThb: "128250",
      openingMmk: "5918129",
      openingThb: "235299",
      reason: "Corrected the June cash count",
    });

    expect(updated.id).toBe(created.id);
    const dashboard = await caller.dashboard.today({ date: "2026-07-01" });
    expect(dashboard.closingBalance).toEqual({
      mmk: "17407400.0000",
      thb: "128250.0000",
    });
    const history = await caller.operations.revisionHistory({
      entity: "opening-balance",
      entityId: created.id,
    });
    expect(history.map(({ action, reason }) => ({ action, reason }))).toEqual([
      { action: "create", reason: "Balance configuration created" },
      { action: "update", reason: "Corrected the June cash count" },
    ]);
  });

  test("adds an exchange using actual settlement for balance and formula profit for reporting", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.saveBalanceConfiguration({
      calculationStartDate: "2026-07-01",
      checkpointMmk: "17407355",
      checkpointThb: "128200",
      openingMmk: "5918129",
      openingThb: "235299",
    });

    const rate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-01T00:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    const created = await caller.operations.createExchange({
      actualPayout: "25900",
      description: "Opening day exchange",
      direction: "thb-to-mmk",
      rateVersionId: rate.id,
      sourceAmount: "200",
      transactionAt: "2026-07-01T10:00:00+06:30",
    });

    expect(created).toMatchObject({
      actualPayout: "25900.0000",
      actualSettlementProfitThb: "6.2680",
      calculatedPayout: "25974.0260",
      formulaProfitThb: "5.7143",
      settlementVarianceThb: "0.5537",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-01" });
    expect(dashboard.closingBalance).toEqual({
      mmk: "17381455.0000",
      thb: "128400.0000",
    });
    expect(dashboard.totals.exchangeFormulaProfitThb).toBe("5.7143");
    expect(dashboard.recentTransactions).toHaveLength(1);
  });

  test("reports Cash to Bank fees without changing the exchange float balance", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.saveBalanceConfiguration({
      calculationStartDate: "2026-07-01",
      checkpointMmk: "17407355",
      checkpointThb: "128200",
      openingMmk: "5918129",
      openingThb: "235299",
    });

    const cashBank = await caller.operations.createCashBank({
      currency: "MMK",
      description: "Cash received and bank transfer sent",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "120000",
      transactionAt: "2026-07-01T09:00:00+06:30",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-01" });
    expect(dashboard.totals.cashBankFeeMmk).toBe("1200.0000");
    expect(dashboard.closingBalance).toEqual({
      mmk: "17407355.0000",
      thb: "128200.0000",
    });
    expect(dashboard.recentTransactions[0]).toMatchObject({
      currency: "MMK",
      feeAmount: "1200.0000",
      type: "cash-bank",
    });
    const records = await caller.operations.list({ date: "2026-07-01", type: "cash-bank" });
    expect(records).toHaveLength(1);
    const storedCashBank = await caller.operations.getCashBank({ id: cashBank.id });
    expect(storedCashBank.feeAmount).toBe("1200.0000");

    await caller.operations.updateCashBank({
      currency: "MMK",
      description: "Corrected principal",
      direction: "cash-to-bank",
      feeRate: "0.01",
      id: cashBank.id,
      principalAmount: "100000",
      reason: "Corrected the service principal",
      transactionAt: "2026-07-01T09:15:00+06:30",
    });
    const corrected = await caller.dashboard.today({ date: "2026-07-01" });
    expect(corrected.totals.cashBankFeeMmk).toBe("1000.0000");
  });

  test("keeps expenses separate from reported profit", async () => {
    const caller = appRouter.createCaller(activeContext());

    const expenseRecord = await caller.operations.createExpense({
      amount: "150000",
      currency: "MMK",
      description: "Office expense",
      transactionAt: "2026-07-01T10:00:00+06:30",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-01" });
    expect(dashboard.totals).toMatchObject({
      exchangeFormulaProfitThb: "0.0000",
      expensesMmk: "150000.0000",
    });
    expect(dashboard.recentTransactions[0]).toMatchObject({
      amount: "150000.0000",
      currency: "MMK",
      type: "expense",
    });
    const storedExpense = await caller.operations.getExpense({ id: expenseRecord.id });
    expect(storedExpense.amount).toBe("150000.0000");

    await caller.operations.updateExpense({
      amount: "160000",
      currency: "MMK",
      description: "Corrected office expense",
      id: expenseRecord.id,
      reason: "Corrected the expense receipt",
      transactionAt: "2026-07-01T10:15:00+06:30",
    });
    const corrected = await caller.dashboard.today({ date: "2026-07-01" });
    expect(corrected.totals.expensesMmk).toBe("160000.0000");
  });

  test("recalculates this month's profit after a retrospective edit without subtracting expenses", async () => {
    const caller = appRouter.createCaller(activeContext());
    const rate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-01T00:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    await caller.operations.createExchange({
      actualPayout: "25900",
      direction: "thb-to-mmk",
      rateVersionId: rate.id,
      sourceAmount: "200",
      transactionAt: "2026-07-01T10:00:00+06:30",
    });
    await caller.operations.createCashBank({
      currency: "THB",
      direction: "bank-to-cash",
      feeRate: "0.02",
      principalAmount: "1000",
      transactionAt: "2026-07-05T09:00:00+06:30",
    });
    const mmkFee = await caller.operations.createCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "100000",
      transactionAt: "2026-07-10T09:00:00+06:30",
    });
    await caller.operations.createExpense({
      amount: "9999",
      currency: "THB",
      description: "Excluded from profit",
      transactionAt: "2026-07-12T09:00:00+06:30",
    });
    await caller.operations.createCashBank({
      currency: "THB",
      direction: "bank-to-cash",
      feeRate: "0.03",
      principalAmount: "1000",
      transactionAt: "2026-06-30T09:00:00+06:30",
    });
    await caller.operations.createCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "200000",
      transactionAt: "2026-07-24T09:00:00+06:30",
    });

    const initial = await caller.dashboard.today({ date: "2026-07-23" });
    expect(initial.profitThisMonth).toEqual({
      fromDate: "2026-07-01",
      mmk: "1000.0000",
      thb: "25.7143",
      toDate: "2026-07-23",
    });

    await caller.operations.updateCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      id: mmkFee.id,
      principalAmount: "150000",
      reason: "Corrected a past transaction",
      transactionAt: "2026-07-10T10:00:00+06:30",
    });

    const corrected = await caller.dashboard.today({ date: "2026-07-23" });
    expect(corrected.profitThisMonth).toEqual({
      fromDate: "2026-07-01",
      mmk: "1500.0000",
      thb: "25.7143",
      toDate: "2026-07-23",
    });
  });

  test("recalculates later balances and preserves the reason for a retrospective edit", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.saveBalanceConfiguration({
      calculationStartDate: "2026-07-01",
      checkpointMmk: "17407355",
      checkpointThb: "128200",
      openingMmk: "5918129",
      openingThb: "235299",
    });
    const rate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-01T00:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    const exchange = await caller.operations.createExchange({
      actualPayout: "25900",
      direction: "thb-to-mmk",
      rateVersionId: rate.id,
      sourceAmount: "200",
      transactionAt: "2026-07-01T10:00:00+06:30",
    });
    const storedExchange = await caller.operations.getExchange({ id: exchange.id });
    expect(storedExchange.actualPayout).toBe("25900.0000");

    await caller.operations.updateExchange({
      actualPayout: "25800",
      description: "Corrected payout",
      direction: "thb-to-mmk",
      id: exchange.id,
      rateMode: "preserve",
      reason: "Corrected the recorded MMK payout",
      sourceAmount: "200",
      transactionAt: "2026-07-01T10:00:00+06:30",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-01" });
    expect(dashboard.closingBalance).toEqual({
      mmk: "17381555.0000",
      thb: "128400.0000",
    });
    const history = await caller.operations.revisionHistory({
      entity: "exchange",
      entityId: exchange.id,
    });
    expect(history.map(({ action, reason }) => ({ action, reason }))).toEqual([
      { action: "create", reason: "Exchange transaction created" },
      { action: "update", reason: "Corrected the recorded MMK payout" },
    ]);
  });
});
