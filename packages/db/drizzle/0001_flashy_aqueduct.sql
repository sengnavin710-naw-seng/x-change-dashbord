CREATE TYPE "public"."cash_bank_direction" AS ENUM('bank-to-cash', 'cash-to-bank');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('THB', 'MMK');--> statement-breakpoint
CREATE TYPE "public"."exchange_direction" AS ENUM('thb-to-mmk', 'mmk-to-thb');--> statement-breakpoint
CREATE TYPE "public"."revision_action" AS ENUM('create', 'update', 'void');--> statement-breakpoint
CREATE TYPE "public"."revision_entity" AS ENUM('opening-balance', 'exchange', 'exchange-rate', 'cash-bank', 'expense');--> statement-breakpoint
CREATE TABLE "opening_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"effective_date" date NOT NULL,
	"reference_thb" numeric(20, 4) NOT NULL,
	"reference_mmk" numeric(20, 4) NOT NULL,
	"operational_thb" numeric(20, 4) NOT NULL,
	"operational_mmk" numeric(20, 4) NOT NULL,
	"reconciled" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_bank_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" date NOT NULL,
	"transaction_at" timestamp with time zone,
	"currency" "currency" NOT NULL,
	"direction" "cash_bank_direction" NOT NULL,
	"description" text,
	"fee_rate" numeric(18, 8) NOT NULL,
	"principal_amount" numeric(20, 4) NOT NULL,
	"bank_in" numeric(20, 4) NOT NULL,
	"bank_out" numeric(20, 4) NOT NULL,
	"cash_in" numeric(20, 4) NOT NULL,
	"cash_out" numeric(20, 4) NOT NULL,
	"fee_amount" numeric(20, 4) NOT NULL,
	"voided_at" timestamp,
	"void_reason" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_rate" numeric(18, 8) NOT NULL,
	"thb_to_mmk_spread" numeric(18, 8) NOT NULL,
	"mmk_to_thb_spread" numeric(18, 8) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" date NOT NULL,
	"transaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"direction" "exchange_direction" NOT NULL,
	"description" text,
	"source_amount" numeric(20, 4) NOT NULL,
	"base_rate" numeric(18, 8) NOT NULL,
	"spread" numeric(18, 8) NOT NULL,
	"calculated_payout" numeric(20, 4) NOT NULL,
	"actual_payout" numeric(20, 4) NOT NULL,
	"formula_profit_thb" numeric(20, 4) NOT NULL,
	"actual_settlement_profit_thb" numeric(20, 4) NOT NULL,
	"settlement_variance_thb" numeric(20, 4) NOT NULL,
	"exchange_rate_version_id" uuid,
	"rate_overridden" boolean DEFAULT false NOT NULL,
	"rate_override_reason" text,
	"voided_at" timestamp,
	"void_reason" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" date NOT NULL,
	"transaction_at" timestamp with time zone,
	"currency" "currency" NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"description" text NOT NULL,
	"voided_at" timestamp,
	"void_reason" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" "revision_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "revision_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opening_balance" ADD CONSTRAINT "opening_balance_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balance" ADD CONSTRAINT "opening_balance_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_bank_transaction" ADD CONSTRAINT "cash_bank_transaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_bank_transaction" ADD CONSTRAINT "cash_bank_transaction_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_version" ADD CONSTRAINT "exchange_rate_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_transaction" ADD CONSTRAINT "exchange_transaction_exchange_rate_version_id_exchange_rate_version_id_fk" FOREIGN KEY ("exchange_rate_version_id") REFERENCES "public"."exchange_rate_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_transaction" ADD CONSTRAINT "exchange_transaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_transaction" ADD CONSTRAINT "exchange_transaction_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revision" ADD CONSTRAINT "record_revision_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opening_balance_effective_date_unique" ON "opening_balance" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "cash_bank_transaction_date_idx" ON "cash_bank_transaction" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "cash_bank_transaction_at_idx" ON "cash_bank_transaction" USING btree ("transaction_at");--> statement-breakpoint
CREATE INDEX "cash_bank_transaction_active_date_idx" ON "cash_bank_transaction" USING btree ("voided_at","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_effective_at_unique" ON "exchange_rate_version" USING btree ("effective_at");--> statement-breakpoint
CREATE INDEX "exchange_rate_effective_at_idx" ON "exchange_rate_version" USING btree ("effective_at");--> statement-breakpoint
CREATE INDEX "exchange_transaction_date_idx" ON "exchange_transaction" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "exchange_transaction_at_idx" ON "exchange_transaction" USING btree ("transaction_at");--> statement-breakpoint
CREATE INDEX "exchange_transaction_rate_version_idx" ON "exchange_transaction" USING btree ("exchange_rate_version_id");--> statement-breakpoint
CREATE INDEX "exchange_transaction_active_date_idx" ON "exchange_transaction" USING btree ("voided_at","transaction_date");--> statement-breakpoint
CREATE INDEX "expense_date_idx" ON "expense" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "expense_transaction_at_idx" ON "expense" USING btree ("transaction_at");--> statement-breakpoint
CREATE INDEX "record_revision_entity_idx" ON "record_revision" USING btree ("entity","entity_id");