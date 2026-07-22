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

import { appRouter } from "../../src/root";
import type { TRPCContext } from "../../src/trpc";

const now = new Date();
let connection: ReturnType<typeof createDatabase>;

beforeAll(() => {
  const url = new URL(String(process.env.TEST_DATABASE_URL));
  url.pathname = `/${url.pathname.slice(1).replace(/_test$/, "_api_test")}`;
  connection = createDatabase(url.toString());
});

afterAll(async () => connection.pool.end());

beforeEach(async () => {
  await connection.db.delete(recordRevision);
  await connection.db.delete(cashBankTransaction);
  await connection.db.delete(exchangeTransaction);
  await connection.db.delete(expense);
  await connection.db.delete(balanceConfiguration);
  await connection.db.delete(exchangeRateVersion);
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

describe("versioned exchange rates", () => {
  test("rejects selling and buying rates that cross the shop purchase rate", async () => {
    const caller = appRouter.createCaller(activeContext());
    await expect(
      caller.exchangeRates.create({
        baseRate: "0.00748",
        effectiveAt: "2026-07-20T09:00:00+06:30",
        mmkToThbBuyingRate: "0.00750",
        thbToMmkSellingRate: "0.00740",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("keeps the latest effective rate active until a newer version starts", async () => {
    const caller = appRouter.createCaller(activeContext());
    const morning = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-20T09:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      note: "Morning market rate",
      thbToMmkSellingRate: "0.00770",
    });
    const afternoon = await caller.exchangeRates.create({
      baseRate: "0.00750",
      effectiveAt: "2026-07-20T14:30:00+06:30",
      mmkToThbBuyingRate: "0.00745",
      thbToMmkSellingRate: "0.00770",
    });

    expect(await caller.exchangeRates.current({ at: "2026-07-20T12:00:00+06:30" })).toMatchObject({
      id: morning.id,
      thbToMmkCustomerRate: "0.00770000",
    });
    expect(await caller.exchangeRates.current({ at: "2026-07-20T16:00:00+06:30" })).toMatchObject({
      id: afternoon.id,
      mmkToThbCustomerRate: "0.00745000",
    });
    expect(await caller.exchangeRates.history()).toHaveLength(2);
  });

  test("requires a configured rate and snapshots it on a new exchange", async () => {
    const caller = appRouter.createCaller(activeContext());
    await expect(
      caller.operations.createExchange({
        actualPayout: "25900",
        direction: "thb-to-mmk",
        rateVersionId: crypto.randomUUID(),
        sourceAmount: "200",
        transactionAt: "2026-07-20T10:00:00+06:30",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const rate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-20T09:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    const exchange = await caller.operations.createExchange({
      actualPayout: "25900",
      direction: "thb-to-mmk",
      rateVersionId: rate.id,
      sourceAmount: "200",
      transactionAt: "2026-07-20T10:00:00+06:30",
    });

    expect(exchange).toMatchObject({
      baseRate: "0.00748000",
      exchangeRateVersionId: rate.id,
      rateOverridden: false,
      spread: "0.00022000",
      transactionDate: "2026-07-20",
    });
  });

  test("requires a reason for a spread override", async () => {
    const caller = appRouter.createCaller(activeContext());
    const rate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-20T09:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    await expect(
      caller.operations.createExchange({
        actualPayout: "25900",
        direction: "thb-to-mmk",
        rateVersionId: rate.id,
        sourceAmount: "200",
        spreadOverride: "0.00020",
        transactionAt: "2026-07-20T10:00:00+06:30",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("rejects a stale rate without a reason", async () => {
    const caller = appRouter.createCaller(activeContext());
    const oldRate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-20T09:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    await caller.exchangeRates.create({
      baseRate: "0.00750",
      effectiveAt: "2026-07-20T10:30:00+06:30",
      mmkToThbBuyingRate: "0.00745",
      thbToMmkSellingRate: "0.00770",
    });
    let conflict: unknown;
    try {
      await caller.operations.createExchange({
        actualPayout: "25900",
        direction: "thb-to-mmk",
        rateVersionId: oldRate.id,
        sourceAmount: "200",
        transactionAt: "2026-07-20T11:00:00+06:30",
      });
    } catch (cause) {
      conflict = cause;
    }
    expect(conflict).toMatchObject({ code: "CONFLICT" });
  });

  test("keeps a stale displayed rate when the operator records a reason", async () => {
    const caller = appRouter.createCaller(activeContext());
    const oldRate = await caller.exchangeRates.create({
      baseRate: "0.00748",
      effectiveAt: "2026-07-20T09:00:00+06:30",
      mmkToThbBuyingRate: "0.00740",
      thbToMmkSellingRate: "0.00770",
    });
    await caller.exchangeRates.create({
      baseRate: "0.00750",
      effectiveAt: "2026-07-20T10:30:00+06:30",
      mmkToThbBuyingRate: "0.00745",
      thbToMmkSellingRate: "0.00770",
    });
    const kept = await caller.operations.createExchange({
      actualPayout: "25900",
      direction: "thb-to-mmk",
      rateOverrideReason: "Customer accepted the displayed counter rate",
      rateVersionId: oldRate.id,
      sourceAmount: "200",
      transactionAt: "2026-07-20T11:00:00+06:30",
    });
    expect(kept).toMatchObject({ rateOverridden: true, rateOverrideReason: expect.any(String) });
  });
});
