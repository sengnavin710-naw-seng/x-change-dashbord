import { describe, expect, test } from "bun:test";

import {
  calculateCashBank,
  calculateExchange,
  calculateExchangeRateConfiguration,
} from "../../src/index";

describe("exchange calculation", () => {
  test("derives shop margins from the purchase, selling, and buying rates", () => {
    expect(
      calculateExchangeRateConfiguration({
        baseRate: "0.00748",
        mmkToThbBuyingRate: "0.00740",
        thbToMmkSellingRate: "0.00765",
      }),
    ).toEqual({
      baseRate: "0.00748000",
      mmkToThbBuyingRate: "0.00740000",
      mmkToThbProfitPerHundredThousand: "8.0000",
      mmkToThbSpread: "0.00008000",
      thbToMmkProfitPerHundredThousand: "17.0000",
      thbToMmkSellingRate: "0.00765000",
      thbToMmkSpread: "0.00017000",
    });
  });

  test("rejects customer rates that cross the shop purchase rate", () => {
    expect(() =>
      calculateExchangeRateConfiguration({
        baseRate: "0.00748",
        mmkToThbBuyingRate: "0.00750",
        thbToMmkSellingRate: "0.00740",
      }),
    ).toThrow();
  });

  test("keeps formula profit separate from the actual MMK settlement", () => {
    const result = calculateExchange({
      actualPayout: "25900",
      baseRate: "0.00748",
      direction: "thb-to-mmk",
      sourceAmount: "200",
      spread: "0.00022",
    });

    expect(result).toEqual({
      actualSettlementProfitThb: "6.2680",
      calculatedPayout: "25974.0260",
      formulaProfitThb: "5.7143",
      settlementVarianceThb: "0.5537",
    });
  });

  test("calculates an MMK to THB payout with its explicit spread", () => {
    const result = calculateExchange({
      actualPayout: "199.8",
      baseRate: "0.00748",
      direction: "mmk-to-thb",
      sourceAmount: "27000",
      spread: "0.00008",
    });

    expect(result).toEqual({
      actualSettlementProfitThb: "2.1600",
      calculatedPayout: "199.8000",
      formulaProfitThb: "2.1600",
      settlementVarianceThb: "0.0000",
    });
  });
});

describe("cash and bank calculation", () => {
  test("records a cash-in and bank-out service as one directional transaction", () => {
    const result = calculateCashBank({
      currency: "MMK",
      direction: "cash-to-bank",
      feeRate: "0.01",
      principalAmount: "120000",
    });

    expect(result).toEqual({
      bankIn: "0.0000",
      bankOut: "120000.0000",
      cashIn: "121200.0000",
      cashOut: "0.0000",
      currency: "MMK",
      feeAmount: "1200.0000",
    });
  });
});
