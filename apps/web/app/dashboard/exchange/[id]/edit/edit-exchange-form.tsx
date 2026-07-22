"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api";
import { calculateExchange } from "@repo/api/operations";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import {
  formatRate,
  formatWholePayout,
  formatYangonDateTime,
  getYangonDateTime,
  toYangonIso,
} from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

type ExchangeRecord = inferRouterOutputs<AppRouter>["operations"]["getExchange"];
type RateMode = "historical" | "override" | "preserve";
const selectClass =
  "h-11 w-full rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]";

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function EditExchangeForm({ record }: Readonly<{ record: ExchangeRecord }>) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const initialDateTime = getYangonDateTime(new Date(record.transactionAt));
  const [transactionDate, setTransactionDate] = useState(initialDateTime.date);
  const [transactionTime, setTransactionTime] = useState(initialDateTime.time);
  const [direction, setDirection] = useState(record.direction);
  const [sourceAmount, setSourceAmount] = useState(record.sourceAmount);
  const [actualPayout, setActualPayout] = useState(String(Math.round(Number(record.actualPayout))));
  const [rateMode, setRateMode] = useState<RateMode>("preserve");
  const [overrideSpread, setOverrideSpread] = useState(record.spread);
  const [error, setError] = useState<string | null>(null);
  const transactionAt = useMemo(
    () => toYangonIso(transactionDate, transactionTime),
    [transactionDate, transactionTime],
  );
  const historicalRate = trpc.exchangeRates.current.useQuery(
    { at: transactionAt },
    { enabled: rateMode === "historical" && Boolean(transactionAt) },
  );
  const mutation = trpc.operations.updateExchange.useMutation();
  const previewBase = rateMode === "historical" ? historicalRate.data?.baseRate : record.baseRate;
  const previewSpread =
    rateMode === "historical"
      ? direction === "thb-to-mmk"
        ? historicalRate.data?.thbToMmkSpread
        : historicalRate.data?.mmkToThbSpread
      : rateMode === "override"
        ? overrideSpread
        : record.spread;
  const calculation = useMemo(() => {
    if (!previewBase || !previewSpread || !sourceAmount) return null;
    try {
      return calculateExchange({
        baseRate: previewBase,
        direction,
        sourceAmount,
        spread: previewSpread,
        ...(actualPayout ? { actualPayout } : {}),
      });
    } catch {
      return null;
    }
  }, [actualPayout, direction, previewBase, previewSpread, sourceAmount]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await mutation.mutateAsync({
        actualPayout,
        description: value(form, "description") || undefined,
        direction,
        id: record.id,
        rateMode,
        reason: value(form, "reason"),
        sourceAmount,
        spreadOverride: rateMode === "override" ? overrideSpread : undefined,
        transactionAt,
      });
      await utils.dashboard.today.invalidate();
      router.push("/dashboard/exchange");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update record");
    }
  }

  return (
    <form className="max-w-[720px] border border-[var(--hairline)] bg-white" onSubmit={submit}>
      <div className="grid items-start gap-5 p-5 sm:p-7 [&>label]:block">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Date</span>
          <Input
            disabled={mutation.isPending}
            onChange={(event) => setTransactionDate(event.target.value)}
            required
            type="date"
            value={transactionDate}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Time</span>
          <Input
            disabled={mutation.isPending}
            onChange={(event) => setTransactionTime(event.target.value)}
            required
            type="time"
            value={transactionTime}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Direction</span>
          <select
            className={selectClass}
            disabled={mutation.isPending}
            onChange={(event) => {
              const next = event.target.value as ExchangeRecord["direction"];
              setDirection(next);
              if (next !== record.direction) setRateMode("historical");
            }}
            value={direction}
          >
            <option value="thb-to-mmk">THB to MMK</option>
            <option value="mmk-to-thb">MMK to THB</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            {direction === "thb-to-mmk" ? "IN THB" : "IN MMK"}
          </span>
          <Input
            disabled={mutation.isPending}
            inputMode="decimal"
            onChange={(event) => setSourceAmount(event.target.value)}
            required
            value={sourceAmount}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            {direction === "thb-to-mmk" ? "Actual MMK" : "Actual THB"}
          </span>
          <Input
            disabled={mutation.isPending}
            inputMode="numeric"
            onChange={(event) => setActualPayout(event.target.value.replace(/\D/g, ""))}
            pattern="[0-9]+"
            required
            value={actualPayout}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Rate Handling</span>
          <select
            className={selectClass}
            disabled={mutation.isPending}
            onChange={(event) => setRateMode(event.target.value as RateMode)}
            value={rateMode}
          >
            <option value="preserve">Preserve Original</option>
            <option value="historical">Reapply Historical</option>
            <option value="override">Override Spread</option>
          </select>
        </label>
        {rateMode === "override" ? (
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[var(--ink)]">Override Spread</span>
            <Input
              disabled={mutation.isPending}
              inputMode="decimal"
              onChange={(event) => setOverrideSpread(event.target.value)}
              required
              value={overrideSpread}
            />
          </label>
        ) : null}
        <div className="border border-[var(--hairline)] bg-[#f4f7fb] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
                Rate snapshot
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {rateMode === "historical"
                  ? historicalRate.data
                    ? `Effective ${formatYangonDateTime(historicalRate.data.effectiveAt)}`
                    : "No historical rate found"
                  : record.rateVersion
                    ? `Effective ${formatYangonDateTime(record.rateVersion.effectiveAt)}`
                    : "Original version"}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
              Base {previewBase ? formatRate(previewBase) : "—"} · Spread{" "}
              {previewSpread ? formatRate(previewSpread) : "—"}
            </p>
          </div>
          {calculation ? (
            <div className="mt-4 grid gap-3 border-t border-[var(--hairline)] pt-4 text-xs sm:grid-cols-3">
              <p>
                {direction === "thb-to-mmk" ? "ER MMK" : "OUT THB"}{" "}
                <strong>{formatWholePayout(calculation.calculatedPayout)}</strong>
              </p>
              <p>
                Profit <strong>{calculation.formulaProfitThb} THB</strong>
              </p>
              <p>
                Variance <strong>{calculation.settlementVarianceThb ?? "—"} THB</strong>
              </p>
            </div>
          ) : null}
        </div>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Description</span>
          <Input
            defaultValue={record.description ?? ""}
            disabled={mutation.isPending}
            name="description"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Edit Reason</span>
          <Input disabled={mutation.isPending} minLength={3} name="reason" required />
          <span className="block text-[10px] leading-5 text-[var(--ink-muted)]">
            Required and preserved in revision history.
          </span>
        </label>
      </div>
      {error ? (
        <p
          className="mx-5 mb-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-3 text-sm sm:mx-7"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
        <Button
          disabled={mutation.isPending}
          onClick={() => router.back()}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={mutation.isPending || !calculation} type="submit">
          {mutation.isPending ? "Updating…" : "Update Record"}
        </Button>
      </div>
    </form>
  );
}
