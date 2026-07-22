"use client";

import { useMemo, useState, type FormEvent } from "react";

import { calculateExchangeRateConfiguration } from "@repo/api/operations";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import {
  formatInverseRate,
  formatRate,
  formatYangonDateTime,
  getYangonDateTime,
  toYangonIso,
} from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

function Field({
  children,
  english,
  hint,
  label,
}: Readonly<{
  children: React.ReactNode;
  english: string;
  hint?: string;
  label: string;
}>) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
      <span className="block text-[10px] font-medium tracking-[0.04em] text-[var(--ink-muted)] uppercase">
        {english}
      </span>
      {children}
      {hint ? (
        <span className="block text-xs leading-5 text-[var(--ink-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function RateCell({
  detail,
  label,
  value,
}: Readonly<{ detail?: string; label: string; value: string }>) {
  return (
    <div className="border-t border-[var(--hairline)] px-4 py-4 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="text-[10px] font-semibold tracking-[0.06em] text-[var(--ink-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 font-[var(--font-display)] text-xl font-medium tabular-nums text-[var(--ink)]">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{detail}</p> : null}
    </div>
  );
}

function formatProfit(value: string) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(value));
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
  const [baseRate, setBaseRate] = useState("");
  const [thbToMmkSellingRate, setThbToMmkSellingRate] = useState("");
  const [mmkToThbBuyingRate, setMmkToThbBuyingRate] = useState("");
  const [effectiveAt, setEffectiveAt] = useState(`${initialLocal.date}T${initialLocal.time}`);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const current = trpc.exchangeRates.current.useQuery();
  const history = trpc.exchangeRates.history.useQuery();
  const createRate = trpc.exchangeRates.create.useMutation();

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
      return {
        error: cause instanceof Error ? cause.message : "The rate relationship is invalid.",
        value: null,
      };
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
      setSuccess("နှုန်းအသစ်ကို သိမ်းပြီးပါပြီ။ / New rate version saved.");
      await Promise.all([current.refetch(), history.refetch()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the rate version.");
    }
  }

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="current-rate-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="grid gap-4 border-b border-[var(--hairline)] px-5 py-5 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
              Live rate desk
            </p>
            <h2 id="current-rate-heading" className="mt-2 text-lg font-semibold text-[var(--ink)]">
              လက်ရှိ အသုံးပြုနှုန်း / Current active rates
            </h2>
          </div>
          {current.data ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Effective {formatYangonDateTime(current.data.effectiveAt)}
            </p>
          ) : null}
        </div>

        {current.isLoading ? (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]" role="status">
            နှုန်းကို ဖတ်နေသည်… / Loading rates…
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
              <RateCell
                detail="Shop acquisition cost · THB per MMK"
                label="ဆိုင်ဝယ်ဈေး / Base purchase"
                value={formatRate(current.data.baseRate)}
              />
              <RateCell
                detail={`Customer pays THB · 1 THB ≈ ${formatInverseRate(current.data.thbToMmkCustomerRate)} MMK`}
                label="MMK ရောင်းဈေး / Selling rate"
                value={formatRate(current.data.thbToMmkCustomerRate)}
              />
              <RateCell
                detail={`Customer gives MMK · 1 THB ≈ ${formatInverseRate(current.data.mmkToThbCustomerRate)} MMK`}
                label="MMK ဝယ်ဈေး / Buying rate"
                value={formatRate(current.data.mmkToThbCustomerRate)}
              />
            </div>
            <div className="grid border-t border-[var(--hairline)] bg-[#f4f7fb] md:grid-cols-2">
              <RateCell
                detail={`Spread ${formatRate(currentConfiguration.thbToMmkSpread)} · Selling rate − Base`}
                label="ရောင်းအမြတ် / Selling profit"
                value={`${formatProfit(currentConfiguration.thbToMmkProfitPerHundredThousand)} THB / 100,000 MMK`}
              />
              <RateCell
                detail={`Spread ${formatRate(currentConfiguration.mmkToThbSpread)} · Base − Buying rate`}
                label="ဝယ်အမြတ် / Buying profit"
                value={`${formatProfit(currentConfiguration.mmkToThbProfitPerHundredThousand)} THB / 100,000 MMK`}
              />
            </div>
          </>
        ) : (
          <div className="border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-5">
            <p className="font-semibold text-[var(--ink)]">အသုံးပြုနိုင်သော နှုန်းမရှိသေးပါ။</p>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              No active rate. Save the shop purchase, selling, and buying rates below before
              creating Exchange records.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,760px)_minmax(300px,1fr)]">
        <form className="border border-[var(--hairline)] bg-white" onSubmit={submit}>
          <div className="border-b border-[var(--hairline)] px-5 py-5 sm:px-7">
            <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
              Immutable version
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">
              ဆိုင်နှုန်းအသစ် သတ်မှတ်ရန် / Set new shop rates
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Enter the three rates used by the shop. Spread and profit per 100,000 MMK are
              calculated automatically.
            </p>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <Field
              english="Shop acquisition cost · THB per MMK"
              hint="ဆိုင်က ငွေဝယ်ယူထားသော မူလဈေး / The rate at which the shop acquired MMK."
              label="ဆိုင်ဝယ်ဈေး / Base purchase rate"
            >
              <Input
                disabled={createRate.isPending}
                inputMode="decimal"
                onChange={(event) => setBaseRate(event.target.value)}
                placeholder="e.g. 0.00748"
                required
                value={baseRate}
              />
            </Field>
            <Field english="Effective date & time · Asia/Yangon" label="စတင်အသုံးပြုချိန်">
              <Input
                disabled={createRate.isPending}
                onChange={(event) => setEffectiveAt(event.target.value)}
                required
                type="datetime-local"
                value={effectiveAt}
              />
            </Field>
            <Field
              english="Customer pays THB · receives MMK"
              hint="Must be equal to or higher than the Base purchase rate."
              label="MMK ရောင်းဈေး / THB → MMK selling rate"
            >
              <Input
                disabled={createRate.isPending}
                inputMode="decimal"
                onChange={(event) => setThbToMmkSellingRate(event.target.value)}
                placeholder="e.g. 0.00765"
                required
                value={thbToMmkSellingRate}
              />
            </Field>
            <Field
              english="Customer gives MMK · receives THB"
              hint="Must be equal to or lower than the Base purchase rate."
              label="MMK ဝယ်ဈေး / MMK → THB buying rate"
            >
              <Input
                disabled={createRate.isPending}
                inputMode="decimal"
                onChange={(event) => setMmkToThbBuyingRate(event.target.value)}
                placeholder="e.g. 0.00740"
                required
                value={mmkToThbBuyingRate}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field english="Reason / Note · Optional" label="မှတ်ချက် / Note">
                <Input disabled={createRate.isPending} maxLength={500} name="note" />
              </Field>
            </div>
          </div>
          {error ? (
            <p
              className="mx-5 mb-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-3 text-sm sm:mx-7"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              className="mx-5 mb-5 border-l-4 border-[var(--success)] bg-[#e8f8f0] p-3 text-sm sm:mx-7"
              role="status"
            >
              {success}
            </p>
          ) : null}
          <div className="flex justify-end border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:px-7">
            <Button disabled={createRate.isPending || !configuration.value} type="submit">
              {createRate.isPending
                ? "သိမ်းနေသည်… / Saving…"
                : "ဆိုင်နှုန်းအသစ် သိမ်းရန် / Save new rates"}
            </Button>
          </div>
        </form>

        <aside
          aria-live="polite"
          className="h-fit border border-[var(--hairline)] bg-[#f4f7fb] p-5 sm:p-6"
        >
          <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--ink-muted)] uppercase">
            Profit preview
          </p>
          <h2 className="mt-2 text-base font-semibold text-[var(--ink)]">
            နှုန်းအလိုက် အမြတ် / Rate profit
          </h2>
          {configuration.value ? (
            <dl className="mt-5 space-y-5">
              <div className="border-b border-[var(--hairline)] pb-5">
                <dt className="text-xs font-semibold text-[var(--ink-muted)] uppercase">
                  MMK selling · THB → MMK
                </dt>
                <dd className="mt-2 font-[var(--font-display)] text-3xl font-medium tabular-nums text-[var(--ink)]">
                  {formatProfit(configuration.value.thbToMmkProfitPerHundredThousand)} THB
                </dd>
                <dd className="mt-1 text-xs text-[var(--ink-secondary)]">
                  per 100,000 MMK · Spread {formatRate(configuration.value.thbToMmkSpread)}
                </dd>
                <dd className="mt-3 text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatRate(configuration.value.thbToMmkSellingRate)} −{" "}
                  {formatRate(configuration.value.baseRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[var(--ink-muted)] uppercase">
                  MMK buying · MMK → THB
                </dt>
                <dd className="mt-2 font-[var(--font-display)] text-3xl font-medium tabular-nums text-[var(--ink)]">
                  {formatProfit(configuration.value.mmkToThbProfitPerHundredThousand)} THB
                </dd>
                <dd className="mt-1 text-xs text-[var(--ink-secondary)]">
                  per 100,000 MMK · Spread {formatRate(configuration.value.mmkToThbSpread)}
                </dd>
                <dd className="mt-3 text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatRate(configuration.value.baseRate)} −{" "}
                  {formatRate(configuration.value.mmkToThbBuyingRate)}
                </dd>
              </div>
            </dl>
          ) : configuration.error ? (
            <div className="mt-5 border-l-4 border-[var(--warning)] bg-[#fff8df] p-4" role="alert">
              <p className="text-sm font-semibold text-[var(--ink)]">
                နှုန်းများကို ပြန်စစ်ပါ / Check rates
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-secondary)]">
                {configuration.error}
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">
              Enter the Base purchase, selling, and buying rates to preview both margins.
            </p>
          )}
        </aside>
      </section>

      <section
        aria-labelledby="rate-history-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="border-b border-[var(--hairline)] px-5 py-5 sm:px-7">
          <h2 id="rate-history-heading" className="text-lg font-semibold text-[var(--ink)]">
            နှုန်းမှတ်တမ်း / Rate history
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Purchase, selling, and buying rate versions cannot be edited or deleted.
          </p>
        </div>
        {history.isLoading ? (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]">Loading history…</p>
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
                    <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                      {rate.id === current.data?.id
                        ? "အသုံးပြုနေသည် / Active"
                        : "သမိုင်းမှတ်တမ်း / Historical"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
                    <div>
                      <p className="text-[var(--ink-muted)]">Base purchase</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.baseRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">MMK selling</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.thbToMmkCustomerRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">MMK buying</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.mmkToThbCustomerRate)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--ink-muted)]">Selling profit / 100k</p>
                      <p className="mt-1 font-semibold tabular-nums text-[var(--ink)]">
                        {formatProfit(rateConfiguration.thbToMmkProfitPerHundredThousand)} THB
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">Buying profit / 100k</p>
                      <p className="mt-1 font-semibold tabular-nums text-[var(--ink)]">
                        {formatProfit(rateConfiguration.mmkToThbProfitPerHundredThousand)} THB
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--ink-muted)] lg:text-right">
                    <p>{rate.createdByName ?? "Unknown user"}</p>
                    <p className="mt-1 break-words text-[var(--ink-secondary)]">
                      {rate.note || "No note"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]">
            မှတ်တမ်းမရှိသေးပါ။ / No rate versions yet.
          </p>
        )}
      </section>
    </div>
  );
}
