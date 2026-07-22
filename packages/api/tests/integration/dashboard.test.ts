import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
  cashBankTransaction,
  createDatabase,
  exchangeRateVersion,
  exchangeTransaction,
  expense,
  openingBalance,
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
  await connection.db.delete(openingBalance);
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
  test("returns an honest empty state before an opening balance is configured", async () => {
    const caller = appRouter.createCaller(activeContext());

    await expect(caller.dashboard.today({ date: "2026-07-22" })).resolves.toEqual({
      balance: null,
      date: "2026-07-22",
      openingBalance: null,
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

  test("keeps reference and operational opening balances visibly unreconciled", async () => {
    const caller = appRouter.createCaller(activeContext());

    await caller.operations.createOpeningBalance({
      effectiveDate: "2026-07-01",
      note: "Imported as two separate opening figures pending reconciliation.",
      operationalMmk: "17407355",
      operationalThb: "128200",
      referenceMmk: "5918129",
      referenceThb: "235299",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-22" });
    expect(dashboard.openingBalance).toEqual({
      effectiveDate: "2026-07-01",
      operationalMmk: "17407355.0000",
      operationalThb: "128200.0000",
      reconciled: false,
      referenceMmk: "5918129.0000",
      referenceThb: "235299.0000",
    });
    expect(dashboard.balance).toEqual({
      mmk: "17407355.0000",
      thb: "128200.0000",
    });
  });

  test("adds an exchange using actual settlement for balance and formula profit for reporting", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.createOpeningBalance({
      effectiveDate: "2026-07-01",
      operationalMmk: "17407355",
      operationalThb: "128200",
      referenceMmk: "5918129",
      referenceThb: "235299",
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
    expect(dashboard.balance).toEqual({
      mmk: "17381455.0000",
      thb: "128400.0000",
    });
    expect(dashboard.totals.exchangeFormulaProfitThb).toBe("5.7143");
    expect(dashboard.recentTransactions).toHaveLength(1);
  });

  test("reports Cash to Bank fees without changing the exchange float balance", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.createOpeningBalance({
      effectiveDate: "2026-07-01",
      operationalMmk: "17407355",
      operationalThb: "128200",
      referenceMmk: "5918129",
      referenceThb: "235299",
    });

    const cashBank = await caller.operations.createCashBank({
      currency: "MMK",
      description: "Cash received and bank transfer sent",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "120000",
      transactionDate: "2026-07-01",
    });

    const dashboard = await caller.dashboard.today({ date: "2026-07-01" });
    expect(dashboard.totals.cashBankFeeMmk).toBe("1200.0000");
    expect(dashboard.balance).toEqual({
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
      transactionDate: "2026-07-01",
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
      transactionDate: "2026-07-01",
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
      transactionDate: "2026-07-01",
    });
    const corrected = await caller.dashboard.today({ date: "2026-07-01" });
    expect(corrected.totals.expensesMmk).toBe("160000.0000");
  });

  test("recalculates later balances and preserves the reason for a retrospective edit", async () => {
    const caller = appRouter.createCaller(activeContext());
    await caller.operations.createOpeningBalance({
      effectiveDate: "2026-07-01",
      operationalMmk: "17407355",
      operationalThb: "128200",
      referenceMmk: "5918129",
      referenceThb: "235299",
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
    expect(dashboard.balance).toEqual({
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
