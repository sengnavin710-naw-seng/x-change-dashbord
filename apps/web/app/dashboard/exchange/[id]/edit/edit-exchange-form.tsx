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
  toYangonIsoFromLocalDateTime,
} from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

import { DateTimeInput, FormSelect, LoadingSpinner } from "../../../form-controls";
import { rememberRecentTransaction } from "../../../transaction-motion";
import { useLanguage } from "../../../../language-provider";

type ExchangeRecord = inferRouterOutputs<AppRouter>["operations"]["getExchange"];
type RateMode = "historical" | "override" | "preserve";
const selectClass =
  "h-11 w-full rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]";

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function EditExchangeForm({ record }: Readonly<{ record: ExchangeRecord }>) {
  const router = useRouter();
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const initialDateTime = getYangonDateTime(new Date(record.transactionAt));
  const [transactionDateTime, setTransactionDateTime] = useState(
    `${initialDateTime.date}T${initialDateTime.time}`,
  );
  const [direction, setDirection] = useState(record.direction);
  const [sourceAmount, setSourceAmount] = useState(record.sourceAmount);
  const [actualPayout, setActualPayout] = useState(String(Math.round(Number(record.actualPayout))));
  const [rateMode, setRateMode] = useState<RateMode>("preserve");
  const [overrideSpread, setOverrideSpread] = useState(record.spread);
  const [error, setError] = useState<string | null>(null);
  const transactionAt = useMemo(
    () => toYangonIsoFromLocalDateTime(transactionDateTime),
    [transactionDateTime],
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
      rememberRecentTransaction({ id: record.id, type: "exchange" });
      router.push("/dashboard/exchange");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("unableToUpdateRecord"));
    }
  }

  return (
    <form className="max-w-[720px] border border-[var(--hairline)] bg-white" onSubmit={submit}>
      <div className="grid items-start gap-5 p-5 sm:p-7 [&>label]:block">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">{t("dateTime")}</span>
          <DateTimeInput
            disabled={mutation.isPending}
            onChange={(event) => setTransactionDateTime(event.target.value)}
            required
            value={transactionDateTime}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">{t("direction")}</span>
          <FormSelect
            className={selectClass}
            disabled={mutation.isPending}
            onChange={(event) => {
              const next = event.target.value as ExchangeRecord["direction"];
              setDirection(next);
              if (next !== record.direction) setRateMode("historical");
            }}
            value={direction}
          >
            <option value="thb-to-mmk">{t("thbToMmk")}</option>
            <option value="mmk-to-thb">{t("mmkToThb")}</option>
          </FormSelect>
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
            {direction === "thb-to-mmk" ? t("actualMmk") : t("actualThb")}
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
          <span className="block text-sm font-semibold text-[var(--ink)]">{t("rateHandling")}</span>
          <FormSelect
            className={selectClass}
            disabled={mutation.isPending}
            onChange={(event) => setRateMode(event.target.value as RateMode)}
            value={rateMode}
          >
            <option value="preserve">{t("preserveOriginal")}</option>
            <option value="historical">{t("reapplyHistorical")}</option>
            <option value="override">{t("overrideSpread")}</option>
          </FormSelect>
        </label>
        {rateMode === "override" ? (
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[var(--ink)]">
              {t("overrideSpread")}
            </span>
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
                {t("rateSnapshot")}
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
                {t("profit")} <strong>{calculation.formulaProfitThb} THB</strong>
              </p>
              <p>
                {t("variance")} <strong>{calculation.settlementVarianceThb ?? "—"} THB</strong>
              </p>
            </div>
          ) : null}
        </div>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">{t("description")}</span>
          <Input
            defaultValue={record.description ?? ""}
            disabled={mutation.isPending}
            name="description"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">{t("editReason")}</span>
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
          {t("cancel")}
        </Button>
        <Button disabled={mutation.isPending || !calculation} type="submit">
          {mutation.isPending ? (
            <>
              <LoadingSpinner className="mr-2" />
              {t("updating")}
            </>
          ) : (
            t("updateRecord")
          )}
        </Button>
      </div>
    </form>
  );
}
