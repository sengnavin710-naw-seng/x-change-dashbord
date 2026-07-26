"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api";
import { calculateExchange } from "@repo/api/operations";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import {
  formatInverseRate,
  formatRate,
  formatWholePayout,
  formatYangonDateTime,
  toYangonIsoFromLocalDateTime,
} from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

import { useLanguage } from "../../language-provider";
import { DateTimeInput, FormSelect, LoadingSpinner } from "../form-controls";
import type { RecentTransaction } from "../transaction-motion";

type EntryType = "cash-bank" | "exchange" | "expense";
type Direction = "mmk-to-thb" | "thb-to-mmk";
type RateQuote = NonNullable<inferRouterOutputs<AppRouter>["exchangeRates"]["current"]>;

const selectClass =
  "h-11 w-full rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2] disabled:cursor-not-allowed disabled:opacity-55";

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function Field({ children, label }: Readonly<{ children: React.ReactNode; label: string }>) {
  return (
    <label className="grid min-w-0 max-w-full content-start gap-2">
      <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

export function EntryForm({
  defaultDate,
  defaultTime,
  embedded = false,
  initialEntryType = "exchange",
  onPendingChange,
  onSaved,
  showTypeSelector = true,
}: Readonly<{
  defaultDate: string;
  defaultTime: string;
  embedded?: boolean;
  initialEntryType?: EntryType;
  onPendingChange?: (pending: boolean) => void;
  onSaved?: (transaction: RecentTransaction) => void;
  showTypeSelector?: boolean;
}>) {
  const router = useRouter();
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const [entryType, setEntryType] = useState<EntryType>(initialEntryType);
  const [cashCurrency, setCashCurrency] = useState<"MMK" | "THB">("MMK");
  const [direction, setDirection] = useState<Direction>("thb-to-mmk");
  const [transactionDateTime, setTransactionDateTime] = useState(`${defaultDate}T${defaultTime}`);
  const [sourceAmount, setSourceAmount] = useState("");
  const [actualPayout, setActualPayout] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideSpread, setOverrideSpread] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [staleRates, setStaleRates] = useState<{
    old: RateQuote;
    next: RateQuote;
    keepOld: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const transactionAt = useMemo(
    () => toYangonIsoFromLocalDateTime(transactionDateTime),
    [transactionDateTime],
  );
  const rateQuery = trpc.exchangeRates.current.useQuery(
    { at: transactionAt },
    { enabled: entryType === "exchange" && Boolean(transactionAt), staleTime: 0 },
  );
  const createExchange = trpc.operations.createExchange.useMutation();
  const createCashBank = trpc.operations.createCashBank.useMutation();
  const createExpense = trpc.operations.createExpense.useMutation();
  const isPending = createExchange.isPending || createCashBank.isPending || createExpense.isPending;

  useEffect(() => {
    onPendingChange?.(isPending);
    return () => onPendingChange?.(false);
  }, [isPending, onPendingChange]);

  const selectedRate = staleRates?.keepOld ? staleRates.old : rateQuery.data;
  const defaultSpread = selectedRate
    ? direction === "thb-to-mmk"
      ? selectedRate.thbToMmkSpread
      : selectedRate.mmkToThbSpread
    : "";
  const appliedSpread = overrideEnabled ? overrideSpread : defaultSpread;
  const calculation = useMemo(() => {
    if (!selectedRate || !sourceAmount || !appliedSpread) return null;
    try {
      return calculateExchange({
        baseRate: selectedRate.baseRate,
        direction,
        sourceAmount,
        spread: appliedSpread,
        ...(actualPayout ? { actualPayout } : {}),
      });
    } catch {
      return null;
    }
  }, [actualPayout, appliedSpread, direction, selectedRate, sourceAmount]);
  const mmkHundredWarning =
    direction === "thb-to-mmk" && actualPayout !== "" && Number(actualPayout) % 100 !== 0;

  function resetExchangeState() {
    setSourceAmount("");
    setActualPayout("");
    setOverrideEnabled(false);
    setOverrideSpread("");
    setOverrideReason("");
    setStaleRates(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    setSuccess(null);

    try {
      let savedTransaction: RecentTransaction;

      if (entryType === "exchange") {
        if (!selectedRate || !transactionAt)
          throw new Error("No active exchange rate is available.");
        if (staleRates && !staleRates.keepOld)
          throw new Error("Choose which rate to use before saving.");
        const result = await createExchange.mutateAsync({
          actualPayout,
          description: value(form, "description") || undefined,
          direction,
          rateOverrideReason: overrideEnabled || staleRates?.keepOld ? overrideReason : undefined,
          rateVersionId: selectedRate.id,
          sourceAmount,
          spreadOverride: overrideEnabled ? overrideSpread : undefined,
          transactionAt,
        });
        setSuccess(
          `Saved · Profit ${result.formulaProfitThb} THB · Actual settlement ${result.actualSettlementProfitThb} THB`,
        );
        savedTransaction = { id: result.id, type: "exchange" };
        resetExchangeState();
      } else if (entryType === "cash-bank") {
        const result = await createCashBank.mutateAsync({
          currency: value(form, "currency") as "MMK" | "THB",
          description: value(form, "description") || undefined,
          direction: value(form, "direction") as "bank-to-cash" | "cash-to-bank",
          feeRate: value(form, "feeRate"),
          principalAmount: value(form, "principalAmount"),
          transactionAt,
        });
        setSuccess(`Saved · Profit ${result.feeAmount} ${result.currency}`);
        savedTransaction = { id: result.id, type: "cash-bank" };
        formElement.reset();
        setCashCurrency("MMK");
      } else {
        const result = await createExpense.mutateAsync({
          amount: value(form, "amount"),
          currency: value(form, "currency") as "MMK" | "THB",
          description: value(form, "description"),
          transactionAt,
        });
        setSuccess(`Saved · ${result.amount} ${result.currency}`);
        savedTransaction = { id: result.id, type: "expense" };
        formElement.reset();
      }
      await utils.dashboard.today.invalidate();
      router.refresh();
      onSaved?.(savedTransaction);
    } catch (cause) {
      if (
        entryType === "exchange" &&
        cause instanceof Error &&
        cause.message.includes("active exchange rate has changed") &&
        selectedRate
      ) {
        const refreshed = await rateQuery.refetch();
        if (refreshed.data && refreshed.data.id !== selectedRate.id) {
          setStaleRates({ keepOld: false, next: refreshed.data, old: selectedRate });
          setError(null);
          return;
        }
      }
      setError(cause instanceof Error ? cause.message : t("unableToSaveEntry"));
    }
  }

  return (
    <div
      className={embedded ? "w-full min-w-0 max-w-full" : "w-full min-w-0 max-w-[720px] space-y-6"}
    >
      {showTypeSelector ? (
        <div className="h-fit border border-[var(--hairline)] bg-[#f4f7fb] p-2">
          {(
            [
              { label: t("exchange"), value: "exchange" },
              { label: t("cashBank"), value: "cash-bank" },
              { label: t("expenses"), value: "expense" },
            ] as const
          ).map((option) => (
            <button
              aria-pressed={entryType === option.value}
              className={`w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset ${entryType === option.value ? "border-[var(--primary)] bg-white" : "border-transparent hover:bg-white"}`}
              key={option.value}
              onClick={() => {
                setEntryType(option.value);
                setError(null);
                setSuccess(null);
              }}
              type="button"
            >
              <span className="block text-sm font-semibold text-[var(--ink)]">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <form
        className={embedded ? "bg-white" : "border border-[var(--hairline)] bg-white"}
        onSubmit={submit}
      >
        {!embedded ? (
          <div className="border-b border-[var(--hairline)] px-5 py-5 sm:px-7">
            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--primary)] uppercase">
              {t("addTransaction")}
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-2xl font-medium text-[var(--ink)]">
              {entryType === "exchange"
                ? t("exchange")
                : entryType === "cash-bank"
                  ? t("cashBank")
                  : t("expenses")}
            </h2>
          </div>
        ) : null}

        <div className="grid w-full min-w-0 max-w-full items-start gap-5 p-5 sm:p-7">
          <Field label={t("dateTime")}>
            <DateTimeInput
              autoFocus={embedded}
              disabled={isPending}
              name="transactionDateTime"
              onChange={(event) => {
                setTransactionDateTime(event.target.value);
                setStaleRates(null);
              }}
              required
              value={transactionDateTime}
            />
          </Field>

          {entryType === "exchange" ? (
            <>
              <Field label={t("direction")}>
                <FormSelect
                  className={selectClass}
                  disabled={isPending}
                  onChange={(event) => {
                    setDirection(event.target.value as Direction);
                    setOverrideEnabled(false);
                    setOverrideSpread("");
                  }}
                  value={direction}
                >
                  <option value="thb-to-mmk">{t("thbToMmk")}</option>
                  <option value="mmk-to-thb">{t("mmkToThb")}</option>
                </FormSelect>
              </Field>
              <Field label={direction === "thb-to-mmk" ? "IN THB" : "IN MMK"}>
                <Input
                  disabled={isPending}
                  inputMode="decimal"
                  onChange={(event) => setSourceAmount(event.target.value)}
                  placeholder="0"
                  required
                  value={sourceAmount}
                />
              </Field>

              <div>
                {rateQuery.isLoading ? (
                  <div
                    className="border border-[var(--hairline)] bg-[#f4f7fb] p-5 text-sm text-[var(--ink-muted)]"
                    role="status"
                  >
                    {t("findingRate")}
                  </div>
                ) : rateQuery.error ? (
                  <div
                    className="border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-4 text-sm"
                    role="alert"
                  >
                    {rateQuery.error.message}
                  </div>
                ) : selectedRate ? (
                  <div className="border border-[var(--hairline)] bg-[#f4f7fb]">
                    <div className="flex flex-col gap-3 border-b border-[var(--hairline)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
                          {t("rateInUse")}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          {t("effective")} {formatYangonDateTime(selectedRate.effectiveAt)}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setOverrideEnabled((value) => !value);
                          setOverrideSpread(defaultSpread);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {overrideEnabled ? t("cancelOverride") : t("overrideSpread")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-[var(--hairline)] sm:grid-cols-4">
                      {[
                        [t("baseRate"), formatRate(selectedRate.baseRate)],
                        [t("spread"), formatRate(appliedSpread)],
                        [
                          direction === "thb-to-mmk" ? t("sellRate") : t("buyRate"),
                          formatRate(
                            direction === "thb-to-mmk"
                              ? String(Number(selectedRate.baseRate) + Number(appliedSpread))
                              : String(Number(selectedRate.baseRate) - Number(appliedSpread)),
                          ),
                        ],
                        [
                          "1 THB ≈ MMK",
                          formatInverseRate(
                            direction === "thb-to-mmk"
                              ? String(Number(selectedRate.baseRate) + Number(appliedSpread))
                              : String(Number(selectedRate.baseRate) - Number(appliedSpread)),
                          ),
                        ],
                      ].map(([label, display]) => (
                        <div className="bg-white p-3" key={label}>
                          <p className="text-[9px] font-semibold text-[var(--ink-muted)] uppercase">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">
                            {display}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-l-4 border-[var(--warning)] bg-[#fff8df] p-4">
                    <p className="font-semibold text-[var(--ink)]">{t("noActiveRate")}</p>
                    <Link
                      className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] underline underline-offset-4"
                      href="/dashboard/exchange-rates"
                    >
                      {t("openExchangeRate")}
                    </Link>
                  </div>
                )}
              </div>

              {overrideEnabled ? (
                <>
                  <Field label={t("overrideSpread")}>
                    <Input
                      disabled={isPending}
                      inputMode="decimal"
                      onChange={(event) => setOverrideSpread(event.target.value)}
                      required
                      value={overrideSpread}
                    />
                  </Field>
                  <Field label={t("reason")}>
                    <Input
                      disabled={isPending}
                      minLength={3}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      required
                      value={overrideReason}
                    />
                  </Field>
                </>
              ) : null}
              <Field label={direction === "thb-to-mmk" ? "ER MMK" : "OUT THB"}>
                <Input
                  aria-readonly
                  readOnly
                  value={calculation ? formatWholePayout(calculation.calculatedPayout) : ""}
                />
              </Field>
              <Field label={direction === "thb-to-mmk" ? t("actualMmk") : t("actualThb")}>
                <Input
                  disabled={isPending}
                  inputMode="numeric"
                  onChange={(event) => setActualPayout(event.target.value.replace(/\D/g, ""))}
                  pattern="[0-9]+"
                  placeholder="0"
                  required
                  value={actualPayout}
                />
              </Field>
              {mmkHundredWarning ? (
                <p className="border-l-4 border-[var(--warning)] bg-[#fff8df] p-3 text-xs leading-5 text-[var(--ink-secondary)]">
                  Actual MMK is not a multiple of 100. You may still save it.
                </p>
              ) : null}
              {calculation?.actualSettlementProfitThb ? (
                <div className="grid gap-3 border border-[var(--hairline)] bg-white p-4 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-[var(--ink-muted)]">{t("profit")}</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {calculation.formulaProfitThb} THB
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--ink-muted)]">{t("actualSettlement")}</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {calculation.actualSettlementProfitThb} THB
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--ink-muted)]">{t("variance")}</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {calculation.settlementVarianceThb} THB
                    </p>
                  </div>
                </div>
              ) : null}
              {staleRates ? (
                <div className="border-l-4 border-[var(--warning)] bg-[#fff8df] p-4">
                  <p className="font-semibold text-[var(--ink)]">{t("theActiveRateChanged")}</p>
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <p>
                      {t("displayed")}: {formatRate(staleRates.old.baseRate)} ·{" "}
                      {formatYangonDateTime(staleRates.old.effectiveAt)}
                    </p>
                    <p>
                      {t("new")}: {formatRate(staleRates.next.baseRate)} ·{" "}
                      {formatYangonDateTime(staleRates.next.effectiveAt)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        setStaleRates(null);
                        setOverrideReason("");
                      }}
                      size="sm"
                      type="button"
                    >
                      {t("useNewRate")}
                    </Button>
                    <Button
                      onClick={() => setStaleRates({ ...staleRates, keepOld: true })}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {t("keepDisplayedRate")}
                    </Button>
                  </div>
                  {staleRates.keepOld ? (
                    <div className="mt-4">
                      <Field label={t("reason")}>
                        <Input
                          minLength={3}
                          onChange={(event) => setOverrideReason(event.target.value)}
                          required
                          value={overrideReason}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : entryType === "cash-bank" ? (
            <>
              <Field label={t("currency")}>
                <FormSelect
                  className={selectClass}
                  disabled={isPending}
                  name="currency"
                  onChange={(event) => setCashCurrency(event.target.value as "MMK" | "THB")}
                  value={cashCurrency}
                >
                  <option value="MMK">MMK</option>
                  <option value="THB">THB</option>
                </FormSelect>
              </Field>
              <Field label={t("direction")}>
                <FormSelect className={selectClass} disabled={isPending} name="direction" required>
                  <option value="bank-to-cash">{t("bankInCashOut")}</option>
                  <option value="cash-to-bank">{t("cashInBankOut")}</option>
                </FormSelect>
              </Field>
              <Field label={t("amount")}>
                <Input
                  disabled={isPending}
                  inputMode="decimal"
                  name="principalAmount"
                  placeholder="0.0000"
                  required
                />
              </Field>
              <Field label={t("feeRate")}>
                <FormSelect className={selectClass} disabled={isPending} name="feeRate" required>
                  {cashCurrency === "MMK" ? <option value="0.01">1%</option> : null}
                  {cashCurrency === "THB" ? <option value="0.02">2%</option> : null}
                  {cashCurrency === "THB" ? <option value="0.03">3%</option> : null}
                </FormSelect>
              </Field>
            </>
          ) : (
            <>
              <Field label={t("currency")}>
                <FormSelect className={selectClass} disabled={isPending} name="currency" required>
                  <option value="THB">THB</option>
                  <option value="MMK">MMK</option>
                </FormSelect>
              </Field>
              <Field label={t("amount")}>
                <Input
                  disabled={isPending}
                  inputMode="decimal"
                  name="amount"
                  placeholder="0.0000"
                  required
                />
              </Field>
            </>
          )}
          <div>
            <Field label={entryType === "expense" ? t("particular") : t("description")}>
              <Input disabled={isPending} name="description" required={entryType === "expense"} />
            </Field>
          </div>
        </div>
        {error ? (
          <div
            className="mx-5 mb-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--ink)] sm:mx-7"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {success ? (
          <div
            className="mx-5 mb-5 border-l-4 border-[var(--success)] bg-[#e8f8f0] px-4 py-3 text-sm text-[var(--ink)] sm:mx-7"
            role="status"
          >
            {success}
          </div>
        ) : null}
        <div
          className={`flex flex-col-reverse gap-3 border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:flex-row sm:justify-end sm:px-7 ${embedded ? "sticky bottom-0 z-10" : ""}`}
        >
          <Button
            disabled={isPending}
            onClick={() => {
              if (entryType === "exchange") resetExchangeState();
            }}
            type="reset"
            variant="outline"
          >
            {t("reset")}
          </Button>
          <Button
            disabled={
              isPending ||
              (entryType === "exchange" &&
                (!selectedRate || !calculation || Boolean(staleRates && !staleRates.keepOld)))
            }
            type="submit"
          >
            {isPending ? (
              <>
                <LoadingSpinner className="mr-2" />
                {t("saving")}
              </>
            ) : (
              t("saveEntry")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
