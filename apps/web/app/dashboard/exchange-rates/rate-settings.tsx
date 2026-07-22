"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { calculateExchangeRateConfiguration } from "@repo/api/operations";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import {
  formatRate,
  formatYangonDateTime,
  getYangonDateTime,
  toYangonIso,
} from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

function Field({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

function RateCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border-t border-[var(--hairline)] px-4 py-4 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
      <p className="mt-3 font-[var(--font-display)] text-2xl font-medium tabular-nums text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}

function ProfitStrip({
  buyingProfit,
  sellingProfit,
}: Readonly<{
  buyingProfit?: string | undefined;
  sellingProfit?: string | undefined;
}>) {
  return (
    <div
      aria-live="polite"
      className="grid border-t border-[var(--hairline)] bg-[#f4f7fb] sm:grid-cols-[minmax(140px,0.7fr)_1fr_1fr]"
    >
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[var(--ink)]">Profit</p>
        <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">per MMK 100,000</p>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-3 sm:border-t-0 sm:border-l">
        <p className="text-xs text-[var(--ink-muted)]">THB to MMK</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--ink)]">
          {sellingProfit ? `${formatProfit(sellingProfit)} THB` : "—"}
        </p>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-3 sm:border-t-0 sm:border-l">
        <p className="text-xs text-[var(--ink-muted)]">MMK to THB</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--ink)]">
          {buyingProfit ? `${formatProfit(buyingProfit)} THB` : "—"}
        </p>
      </div>
    </div>
  );
}

function formatProfit(value: string) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(value));
}

function rateErrorMessage(message: string) {
  if (message.includes("selling rate cannot be lower")) {
    return "Sell Rate must be greater than or equal to Base Rate.";
  }

  if (message.includes("buying rate cannot be higher")) {
    return "Buy Rate must be less than or equal to Base Rate.";
  }

  if (message.includes("greater than zero")) {
    return "Rate must be greater than 0.";
  }

  return message;
}

function configurationFromStoredRate(rate: {
  baseRate: string;
  mmkToThbCustomerRate: string;
  thbToMmkCustomerRate: string;
}) {
  return calculateExchangeRateConfiguration({
    baseRate: rate.baseRate,
    mmkToThbBuyingRate: rate.mmkToThbCustomerRate,
    thbToMmkSellingRate: rate.thbToMmkCustomerRate,
  });
}

export function RateSettings() {
  const initialLocal = useMemo(() => getYangonDateTime(), []);
  const [baseRateDraft, setBaseRateDraft] = useState<string | null>(null);
  const [thbToMmkSellingRateDraft, setThbToMmkSellingRateDraft] = useState<string | null>(null);
  const [mmkToThbBuyingRateDraft, setMmkToThbBuyingRateDraft] = useState<string | null>(null);
  const [effectiveAt, setEffectiveAt] = useState(`${initialLocal.date}T${initialLocal.time}`);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const current = trpc.exchangeRates.current.useQuery();
  const history = trpc.exchangeRates.history.useQuery();
  const createRate = trpc.exchangeRates.create.useMutation();

  const baseRate = baseRateDraft ?? current.data?.baseRate ?? "";
  const thbToMmkSellingRate = thbToMmkSellingRateDraft ?? current.data?.thbToMmkCustomerRate ?? "";
  const mmkToThbBuyingRate = mmkToThbBuyingRateDraft ?? current.data?.mmkToThbCustomerRate ?? "";

  const configuration = useMemo(() => {
    if (!baseRate || !thbToMmkSellingRate || !mmkToThbBuyingRate) {
      return { error: null, value: null };
    }

    try {
      return {
        error: null,
        value: calculateExchangeRateConfiguration({
          baseRate,
          mmkToThbBuyingRate,
          thbToMmkSellingRate,
        }),
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The rate relationship is invalid.";
      return { error: rateErrorMessage(message), value: null };
    }
  }, [baseRate, mmkToThbBuyingRate, thbToMmkSellingRate]);

  const currentConfiguration = current.data ? configurationFromStoredRate(current.data) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSuccess(null);

    try {
      await createRate.mutateAsync({
        baseRate,
        effectiveAt: toYangonIso(effectiveAt.slice(0, 10), effectiveAt.slice(11, 16)),
        mmkToThbBuyingRate,
        note: String(form.get("note") ?? "").trim() || undefined,
        thbToMmkSellingRate,
      });
      await Promise.all([current.refetch(), history.refetch()]);
      setBaseRateDraft(null);
      setThbToMmkSellingRateDraft(null);
      setMmkToThbBuyingRateDraft(null);
      setSuccess("Saved.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to save the rate version.";
      setError(rateErrorMessage(message));
    }
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="current-rate-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] px-5 py-4 sm:px-7">
          <h2 id="current-rate-heading" className="text-lg font-semibold text-[var(--ink)]">
            Current Rate
          </h2>
          {current.data ? (
            <p className="text-xs text-[var(--ink-muted)]">
              {formatYangonDateTime(current.data.effectiveAt)}
            </p>
          ) : null}
        </div>

        {current.isLoading ? (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]" role="status">
            Loading…
          </p>
        ) : current.error ? (
          <p
            className="border-l-4 border-[var(--error)] bg-[var(--error-bg)] px-5 py-4 text-sm"
            role="alert"
          >
            {current.error.message}
          </p>
        ) : current.data && currentConfiguration ? (
          <>
            <div className="grid sm:grid-cols-3">
              <RateCell label="Base Rate" value={formatRate(current.data.baseRate)} />
              <RateCell
                label="THB to MMK · Sell Rate"
                value={formatRate(current.data.thbToMmkCustomerRate)}
              />
              <RateCell
                label="MMK to THB · Buy Rate"
                value={formatRate(current.data.mmkToThbCustomerRate)}
              />
            </div>
            <ProfitStrip
              buyingProfit={currentConfiguration.mmkToThbProfitPerHundredThousand}
              sellingProfit={currentConfiguration.thbToMmkProfitPerHundredThousand}
            />
          </>
        ) : (
          <p className="border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-4 text-sm">
            No rate yet.
          </p>
        )}
      </section>

      <form className="max-w-[720px] border border-[var(--hairline)] bg-white" onSubmit={submit}>
        <div className="border-b border-[var(--hairline)] px-5 py-4 sm:px-7">
          <h2 className="text-lg font-semibold text-[var(--ink)]">New Rate</h2>
        </div>

        <div className="grid gap-5 p-5 sm:p-7">
          <Field label="Base Rate">
            <Input
              disabled={createRate.isPending}
              inputMode="decimal"
              onChange={(event) => setBaseRateDraft(event.target.value)}
              placeholder="0.00748"
              required
              value={baseRate}
            />
          </Field>
          <Field label="THB to MMK · Sell Rate">
            <Input
              disabled={createRate.isPending}
              inputMode="decimal"
              onChange={(event) => setThbToMmkSellingRateDraft(event.target.value)}
              placeholder="0.00765"
              required
              value={thbToMmkSellingRate}
            />
          </Field>
          <Field label="MMK to THB · Buy Rate">
            <Input
              disabled={createRate.isPending}
              inputMode="decimal"
              onChange={(event) => setMmkToThbBuyingRateDraft(event.target.value)}
              placeholder="0.00740"
              required
              value={mmkToThbBuyingRate}
            />
          </Field>
          <Field label="Date">
            <Input
              disabled={createRate.isPending}
              onChange={(event) => setEffectiveAt(event.target.value)}
              required
              type="datetime-local"
              value={effectiveAt}
            />
          </Field>
          <div>
            <Field label="Note (Optional)">
              <Input disabled={createRate.isPending} maxLength={500} name="note" />
            </Field>
          </div>
        </div>

        <ProfitStrip
          buyingProfit={configuration.value?.mmkToThbProfitPerHundredThousand}
          sellingProfit={configuration.value?.thbToMmkProfitPerHundredThousand}
        />

        {configuration.error ? (
          <p
            className="mx-5 mt-5 border-l-4 border-[var(--warning)] bg-[#fff8df] p-3 text-sm sm:mx-7"
            role="alert"
          >
            {configuration.error}
          </p>
        ) : null}
        {error ? (
          <p
            className="mx-5 mt-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-3 text-sm sm:mx-7"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            className="mx-5 mt-5 border-l-4 border-[var(--success)] bg-[#e8f8f0] p-3 text-sm sm:mx-7"
            role="status"
          >
            {success}
          </p>
        ) : null}
        <div className="flex justify-end border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:px-7">
          <Button disabled={createRate.isPending || !configuration.value} type="submit">
            {createRate.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <section
        aria-labelledby="rate-history-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="border-b border-[var(--hairline)] px-5 py-4 sm:px-7">
          <h2 id="rate-history-heading" className="text-lg font-semibold text-[var(--ink)]">
            Rate History
          </h2>
        </div>
        {history.isLoading ? (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]">Loading…</p>
        ) : history.error ? (
          <p
            className="m-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-3 text-sm"
            role="alert"
          >
            {history.error.message}
          </p>
        ) : history.data?.length ? (
          <ol className="divide-y divide-[var(--hairline)]">
            {history.data.map((rate) => {
              const rateConfiguration = configurationFromStoredRate(rate);
              return (
                <li
                  className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[180px_minmax(0,1fr)_minmax(220px,0.8fr)_180px]"
                  key={rate.id}
                >
                  <div>
                    <p className="text-xs font-semibold text-[var(--ink)]">
                      {formatYangonDateTime(rate.effectiveAt)}
                    </p>
                    {rate.id === current.data?.id ? (
                      <p className="mt-1 text-[10px] font-semibold text-[var(--primary)]">Active</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
                    <div>
                      <p className="text-[var(--ink-muted)]">Base Rate</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.baseRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">THB to MMK</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.thbToMmkCustomerRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">MMK to THB</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.mmkToThbCustomerRate)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--ink-muted)]">THB to MMK Profit</p>
                      <p className="mt-1 font-semibold tabular-nums text-[var(--ink)]">
                        {formatProfit(rateConfiguration.thbToMmkProfitPerHundredThousand)} THB
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">MMK to THB Profit</p>
                      <p className="mt-1 font-semibold tabular-nums text-[var(--ink)]">
                        {formatProfit(rateConfiguration.mmkToThbProfitPerHundredThousand)} THB
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--ink-muted)] lg:text-right">
                    {rate.createdByName ? <p>{rate.createdByName}</p> : null}
                    {rate.note ? (
                      <p className="mt-1 break-words text-[var(--ink-secondary)]">{rate.note}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]">No history yet.</p>
        )}
      </section>
    </div>
  );
}
