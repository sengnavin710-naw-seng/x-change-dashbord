const MONEY_SCALE = 4;
const RATE_SCALE = 8;

function powerOfTen(scale: number) {
  return 10n ** BigInt(scale);
}

function parseDecimal(value: string, scale: number) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const sign = match[1] ?? "";
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "";
  if (fraction.length > scale) {
    throw new Error(`Decimal value has more than ${scale} fractional digits: ${value}`);
  }

  const magnitude = BigInt(whole) * powerOfTen(scale) + BigInt(fraction.padEnd(scale, "0") || "0");

  return sign === "-" ? -magnitude : magnitude;
}

function formatDecimal(value: bigint, scale: number) {
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  const divisor = powerOfTen(scale);
  const whole = magnitude / divisor;
  const fraction = (magnitude % divisor).toString().padStart(scale, "0");

  return `${sign}${whole}.${fraction}`;
}

function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) {
    throw new Error("The divisor must be greater than zero.");
  }

  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  return sign * ((magnitude + denominator / 2n) / denominator);
}

function multiplyMoneyByRate(money: bigint, rate: bigint) {
  return divideRounded(money * rate, powerOfTen(RATE_SCALE));
}

export function addMoney(...values: string[]) {
  return formatDecimal(
    values.reduce((total, value) => total + parseDecimal(value, MONEY_SCALE), 0n),
    MONEY_SCALE,
  );
}

export function normalizeMoneyInput(value: string) {
  return value.replace(/[,\s]/g, "");
}

export interface CalculateExchangeInput {
  actualPayout?: string;
  baseRate: string;
  direction: "mmk-to-thb" | "thb-to-mmk";
  sourceAmount: string;
  spread: string;
}

export function calculateExchange(input: CalculateExchangeInput) {
  const sourceAmount = parseDecimal(input.sourceAmount, MONEY_SCALE);
  const baseRate = parseDecimal(input.baseRate, RATE_SCALE);
  const spread = parseDecimal(input.spread, RATE_SCALE);
  const customerRate = input.direction === "thb-to-mmk" ? baseRate + spread : baseRate - spread;

  if (customerRate <= 0n) {
    throw new Error("The customer rate must be greater than zero.");
  }

  const calculatedPayout =
    input.direction === "thb-to-mmk"
      ? divideRounded(sourceAmount * powerOfTen(RATE_SCALE), customerRate)
      : multiplyMoneyByRate(sourceAmount, customerRate);
  const formulaProfit =
    input.direction === "thb-to-mmk"
      ? sourceAmount - multiplyMoneyByRate(calculatedPayout, baseRate)
      : multiplyMoneyByRate(sourceAmount, baseRate) - calculatedPayout;
  const actualPayout = input.actualPayout ? parseDecimal(input.actualPayout, MONEY_SCALE) : null;
  const actualSettlementProfit =
    actualPayout === null
      ? null
      : input.direction === "thb-to-mmk"
        ? sourceAmount - multiplyMoneyByRate(actualPayout, baseRate)
        : multiplyMoneyByRate(sourceAmount, baseRate) - actualPayout;

  return {
    actualSettlementProfitThb:
      actualSettlementProfit === null ? null : formatDecimal(actualSettlementProfit, MONEY_SCALE),
    calculatedPayout: formatDecimal(calculatedPayout, MONEY_SCALE),
    formulaProfitThb: formatDecimal(formulaProfit, MONEY_SCALE),
    settlementVarianceThb:
      actualSettlementProfit === null
        ? null
        : formatDecimal(actualSettlementProfit - formulaProfit, MONEY_SCALE),
  };
}

export function calculateExchangeRateQuote(input: {
  baseRate: string;
  mmkToThbSpread: string;
  thbToMmkSpread: string;
}) {
  const baseRate = parseDecimal(input.baseRate, RATE_SCALE);
  const mmkToThbSpread = parseDecimal(input.mmkToThbSpread, RATE_SCALE);
  const thbToMmkSpread = parseDecimal(input.thbToMmkSpread, RATE_SCALE);

  if (baseRate <= 0n || mmkToThbSpread < 0n || thbToMmkSpread < 0n) {
    throw new Error("Exchange rates and spreads are invalid.");
  }

  const mmkToThbCustomerRate = baseRate - mmkToThbSpread;
  const thbToMmkCustomerRate = baseRate + thbToMmkSpread;
  if (mmkToThbCustomerRate <= 0n) {
    throw new Error("The MMK to THB customer rate must be greater than zero.");
  }

  return {
    mmkToThbCustomerRate: formatDecimal(mmkToThbCustomerRate, RATE_SCALE),
    thbToMmkCustomerRate: formatDecimal(thbToMmkCustomerRate, RATE_SCALE),
  };
}

export interface CalculateExchangeRateConfigurationInput {
  baseRate: string;
  mmkToThbBuyingRate: string;
  thbToMmkSellingRate: string;
}

export function calculateExchangeRateConfiguration(input: CalculateExchangeRateConfigurationInput) {
  const baseRate = parseDecimal(input.baseRate, RATE_SCALE);
  const mmkToThbBuyingRate = parseDecimal(input.mmkToThbBuyingRate, RATE_SCALE);
  const thbToMmkSellingRate = parseDecimal(input.thbToMmkSellingRate, RATE_SCALE);

  if (baseRate <= 0n || mmkToThbBuyingRate <= 0n || thbToMmkSellingRate <= 0n) {
    throw new Error("All exchange rates must be greater than zero.");
  }
  if (thbToMmkSellingRate < baseRate) {
    throw new Error("The MMK selling rate cannot be lower than the base purchase rate.");
  }
  if (mmkToThbBuyingRate > baseRate) {
    throw new Error("The MMK buying rate cannot be higher than the base purchase rate.");
  }

  const thbToMmkSpread = thbToMmkSellingRate - baseRate;
  const mmkToThbSpread = baseRate - mmkToThbBuyingRate;
  const referenceAmount = parseDecimal("100000", MONEY_SCALE);

  return {
    baseRate: formatDecimal(baseRate, RATE_SCALE),
    mmkToThbBuyingRate: formatDecimal(mmkToThbBuyingRate, RATE_SCALE),
    mmkToThbProfitPerHundredThousand: formatDecimal(
      multiplyMoneyByRate(referenceAmount, mmkToThbSpread),
      MONEY_SCALE,
    ),
    mmkToThbSpread: formatDecimal(mmkToThbSpread, RATE_SCALE),
    thbToMmkProfitPerHundredThousand: formatDecimal(
      multiplyMoneyByRate(referenceAmount, thbToMmkSpread),
      MONEY_SCALE,
    ),
    thbToMmkSellingRate: formatDecimal(thbToMmkSellingRate, RATE_SCALE),
    thbToMmkSpread: formatDecimal(thbToMmkSpread, RATE_SCALE),
  };
}

export interface CalculateCashBankInput {
  currency: "MMK" | "THB";
  direction: "bank-to-cash" | "cash-to-bank";
  feeRate: string;
  principalAmount: string;
}

export function calculateCashBank(input: CalculateCashBankInput) {
  const principalAmount = parseDecimal(input.principalAmount, MONEY_SCALE);
  const feeRate = parseDecimal(input.feeRate, RATE_SCALE);

  if (principalAmount <= 0n) {
    throw new Error("The principal amount must be greater than zero.");
  }

  if (feeRate < 0n) {
    throw new Error("The fee rate cannot be negative.");
  }

  const feeAmount = multiplyMoneyByRate(principalAmount, feeRate);
  const receivedAmount = principalAmount + feeAmount;
  const zero = formatDecimal(0n, MONEY_SCALE);
  const principal = formatDecimal(principalAmount, MONEY_SCALE);
  const received = formatDecimal(receivedAmount, MONEY_SCALE);

  return {
    bankIn: input.direction === "bank-to-cash" ? received : zero,
    bankOut: input.direction === "cash-to-bank" ? principal : zero,
    cashIn: input.direction === "cash-to-bank" ? received : zero,
    cashOut: input.direction === "bank-to-cash" ? principal : zero,
    currency: input.currency,
    feeAmount: formatDecimal(feeAmount, MONEY_SCALE),
  };
}
