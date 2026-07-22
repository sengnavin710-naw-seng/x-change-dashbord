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
  toYangonIso,
} from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

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
    <label className="grid content-start gap-2">
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
  onSaved?: () => void;
  showTypeSelector?: boolean;
}>) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [entryType, setEntryType] = useState<EntryType>(initialEntryType);
  const [cashCurrency, setCashCurrency] = useState<"MMK" | "THB">("MMK");
  const [direction, setDirection] = useState<Direction>("thb-to-mmk");
  const [transactionDate, setTransactionDate] = useState(defaultDate);
  const [transactionTime, setTransactionTime] = useState(defaultTime);
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
    () => toYangonIso(transactionDate, transactionTime),
    [transactionDate, transactionTime],
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
        formElement.reset();
      }
      await utils.dashboard.today.invalidate();
      router.refresh();
      onSaved?.();
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
      setError(cause instanceof Error ? cause.message : "Unable to save entry");
    }
  }

  return (
    <div className={embedded ? "w-full" : "max-w-[720px] space-y-6"}>
      {showTypeSelector ? (
        <div className="h-fit border border-[var(--hairline)] bg-[#f4f7fb] p-2">
          {(
            [
              { label: "Exchange", value: "exchange" },
              { label: "Cash ↔ Bank", value: "cash-bank" },
              { label: "Expenses", value: "expense" },
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
              New Entry
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-2xl font-medium text-[var(--ink)]">
              {entryType === "exchange"
                ? "Exchange"
                : entryType === "cash-bank"
                  ? "Cash ↔ Bank"
                  : "Expenses"}
            </h2>
          </div>
        ) : null}

        <div className="grid items-start gap-5 p-5 sm:p-7">
          <Field label="Date">
            <Input
              autoFocus={embedded}
              disabled={isPending}
              name="transactionDate"
              onChange={(event) => {
                setTransactionDate(event.target.value);
                setStaleRates(null);
              }}
              required
              type="date"
              value={transactionDate}
            />
          </Field>

          <Field label="Time">
            <Input
              disabled={isPending}
              name="transactionTime"
              onChange={(event) => {
                setTransactionTime(event.target.value);
                setStaleRates(null);
              }}
              required
              type="time"
              value={transactionTime}
            />
          </Field>

          {entryType === "exchange" ? (
            <>
              <Field label="Direction">
                <select
                  className={selectClass}
                  disabled={isPending}
                  onChange={(event) => {
                    setDirection(event.target.value as Direction);
                    setOverrideEnabled(false);
                    setOverrideSpread("");
                  }}
                  value={direction}
                >
                  <option value="thb-to-mmk">THB to MMK</option>
                  <option value="mmk-to-thb">MMK to THB</option>
                </select>
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
                    Finding rate…
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
                          Rate in use
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          Effective {formatYangonDateTime(selectedRate.effectiveAt)}
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
                        {overrideEnabled ? "Cancel Override" : "Override Spread"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-[var(--hairline)] sm:grid-cols-4">
                      {[
                        ["Base", formatRate(selectedRate.baseRate)],
                        ["Spread", formatRate(appliedSpread)],
                        [
                          direction === "thb-to-mmk" ? "Sell Rate" : "Buy Rate",
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
                    <p className="font-semibold text-[var(--ink)]">No active rate</p>
                    <Link
                      className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] underline underline-offset-4"
                      href="/dashboard/exchange-rates"
                    >
                      Open Exchange Rate
                    </Link>
                  </div>
                )}
              </div>

              {overrideEnabled ? (
                <>
                  <Field label="Override Spread">
                    <Input
                      disabled={isPending}
                      inputMode="decimal"
                      onChange={(event) => setOverrideSpread(event.target.value)}
                      required
                      value={overrideSpread}
                    />
                  </Field>
                  <Field label="Reason">
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
              <Field label={direction === "thb-to-mmk" ? "Actual MMK" : "Actual THB"}>
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
                    <p className="text-[var(--ink-muted)]">Profit</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {calculation.formulaProfitThb} THB
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--ink-muted)]">Actual settlement</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {calculation.actualSettlementProfitThb} THB
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--ink-muted)]">Variance</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {calculation.settlementVarianceThb} THB
                    </p>
                  </div>
                </div>
              ) : null}
              {staleRates ? (
                <div className="border-l-4 border-[var(--warning)] bg-[#fff8df] p-4">
                  <p className="font-semibold text-[var(--ink)]">The active rate changed.</p>
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <p>
                      Displayed: {formatRate(staleRates.old.baseRate)} ·{" "}
                      {formatYangonDateTime(staleRates.old.effectiveAt)}
                    </p>
                    <p>
                      New: {formatRate(staleRates.next.baseRate)} ·{" "}
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
                      Use New Rate
                    </Button>
                    <Button
                      onClick={() => setStaleRates({ ...staleRates, keepOld: true })}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Keep Displayed Rate
                    </Button>
                  </div>
                  {staleRates.keepOld ? (
                    <div className="mt-4">
                      <Field label="Reason">
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
              <Field label="Currency">
                <select
                  className={selectClass}
                  disabled={isPending}
                  name="currency"
                  onChange={(event) => setCashCurrency(event.target.value as "MMK" | "THB")}
                  value={cashCurrency}
                >
                  <option value="MMK">MMK</option>
                  <option value="THB">THB</option>
                </select>
              </Field>
              <Field label="Direction">
                <select className={selectClass} disabled={isPending} name="direction" required>
                  <option value="bank-to-cash">Bank In → Cash Out</option>
                  <option value="cash-to-bank">Cash In → Bank Out</option>
                </select>
              </Field>
              <Field label="Amount">
                <Input
                  disabled={isPending}
                  inputMode="decimal"
                  name="principalAmount"
                  placeholder="0.0000"
                  required
                />
              </Field>
              <Field label="Fee Rate">
                <select className={selectClass} disabled={isPending} name="feeRate" required>
                  {cashCurrency === "MMK" ? <option value="0.01">1%</option> : null}
                  {cashCurrency === "THB" ? <option value="0.02">2%</option> : null}
                  {cashCurrency === "THB" ? <option value="0.03">3%</option> : null}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Currency">
                <select className={selectClass} disabled={isPending} name="currency" required>
                  <option value="THB">THB</option>
                  <option value="MMK">MMK</option>
                </select>
              </Field>
              <Field label="Amount">
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
            <Field label={entryType === "expense" ? "Particular" : "Description"}>
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
            Reset
          </Button>
          <Button
            disabled={
              isPending ||
              (entryType === "exchange" &&
                (!selectedRate || !calculation || Boolean(staleRates && !staleRates.keepOld)))
            }
            type="submit"
          >
            {isPending ? "Saving…" : "Save Entry"}
          </Button>
        </div>
      </form>
    </div>
  );
}
