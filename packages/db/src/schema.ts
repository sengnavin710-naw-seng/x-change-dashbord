import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const authSchema = { account, session, user, verification };

export const currency = pgEnum("currency", ["THB", "MMK"]);
export const exchangeDirection = pgEnum("exchange_direction", ["thb-to-mmk", "mmk-to-thb"]);
export const cashBankDirection = pgEnum("cash_bank_direction", ["bank-to-cash", "cash-to-bank"]);
export const revisionAction = pgEnum("revision_action", ["create", "update", "void"]);
export const revisionEntity = pgEnum("revision_entity", [
  "opening-balance",
  "exchange",
  "exchange-rate",
  "cash-bank",
  "expense",
]);

const money = (name: string) => numeric(name, { precision: 20, scale: 4 });
const rate = (name: string) => numeric(name, { precision: 18, scale: 8 });

export const exchangeRateVersion = pgTable(
  "exchange_rate_version",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    baseRate: rate("base_rate").notNull(),
    thbToMmkSpread: rate("thb_to_mmk_spread").notNull(),
    mmkToThbSpread: rate("mmk_to_thb_spread").notNull(),
    effectiveAt: timestamp("effective_at", { mode: "date", withTimezone: true }).notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("exchange_rate_effective_at_unique").on(table.effectiveAt),
    index("exchange_rate_effective_at_idx").on(table.effectiveAt),
  ],
);

export const openingBalance = pgTable(
  "opening_balance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    referenceThb: money("reference_thb").notNull(),
    referenceMmk: money("reference_mmk").notNull(),
    operationalThb: money("operational_thb").notNull(),
    operationalMmk: money("operational_mmk").notNull(),
    reconciled: boolean("reconciled").default(false).notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("opening_balance_effective_date_unique").on(table.effectiveDate)],
);

export const exchangeTransaction = pgTable(
  "exchange_transaction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    transactionAt: timestamp("transaction_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    direction: exchangeDirection("direction").notNull(),
    description: text("description"),
    sourceAmount: money("source_amount").notNull(),
    baseRate: rate("base_rate").notNull(),
    spread: rate("spread").notNull(),
    calculatedPayout: money("calculated_payout").notNull(),
    actualPayout: money("actual_payout").notNull(),
    formulaProfitThb: money("formula_profit_thb").notNull(),
    actualSettlementProfitThb: money("actual_settlement_profit_thb").notNull(),
    settlementVarianceThb: money("settlement_variance_thb").notNull(),
    exchangeRateVersionId: uuid("exchange_rate_version_id").references(
      () => exchangeRateVersion.id,
    ),
    rateOverridden: boolean("rate_overridden").default(false).notNull(),
    rateOverrideReason: text("rate_override_reason"),
    voidedAt: timestamp("voided_at", { mode: "date" }),
    voidReason: text("void_reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("exchange_transaction_date_idx").on(table.transactionDate),
    index("exchange_transaction_at_idx").on(table.transactionAt),
    index("exchange_transaction_rate_version_idx").on(table.exchangeRateVersionId),
    index("exchange_transaction_active_date_idx").on(table.voidedAt, table.transactionDate),
  ],
);

export const cashBankTransaction = pgTable(
  "cash_bank_transaction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    currency: currency("currency").notNull(),
    direction: cashBankDirection("direction").notNull(),
    description: text("description"),
    feeRate: rate("fee_rate").notNull(),
    principalAmount: money("principal_amount").notNull(),
    bankIn: money("bank_in").notNull(),
    bankOut: money("bank_out").notNull(),
    cashIn: money("cash_in").notNull(),
    cashOut: money("cash_out").notNull(),
    feeAmount: money("fee_amount").notNull(),
    voidedAt: timestamp("voided_at", { mode: "date" }),
    voidReason: text("void_reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cash_bank_transaction_date_idx").on(table.transactionDate),
    index("cash_bank_transaction_active_date_idx").on(table.voidedAt, table.transactionDate),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    currency: currency("currency").notNull(),
    amount: money("amount").notNull(),
    description: text("description").notNull(),
    voidedAt: timestamp("voided_at", { mode: "date" }),
    voidReason: text("void_reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("expense_date_idx").on(table.transactionDate)],
);

export const recordRevision = pgTable(
  "record_revision",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entity: revisionEntity("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: revisionAction("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("record_revision_entity_idx").on(table.entity, table.entityId)],
);

export const operationsSchema = {
  cashBankTransaction,
  exchangeRateVersion,
  exchangeTransaction,
  expense,
  openingBalance,
  recordRevision,
};
