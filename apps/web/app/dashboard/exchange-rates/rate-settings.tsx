"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

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
import { useLanguage } from "../../language-provider";
import { LoadingSpinner } from "../form-controls";

function Field({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <label className="grid gap-3">
      <span className="text-sm leading-6 font-semibold text-[var(--ink)]">{label}</span>
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
  const { t } = useLanguage();

  return (
    <div
      aria-live="polite"
      className="grid border-t border-[var(--hairline)] bg-[#f4f7fb] sm:grid-cols-[minmax(140px,0.7fr)_1fr_1fr]"
    >
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[var(--ink)]">{t("profit")}</p>
        <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{t("perMmkHundredThousand")}</p>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-3 sm:border-t-0 sm:border-l">
        <p className="text-xs text-[var(--ink-muted)]">{t("thbToMmk")}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--ink)]">
          {sellingProfit ? `${formatProfit(sellingProfit)} THB` : "—"}
        </p>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-3 sm:border-t-0 sm:border-l">
        <p className="text-xs text-[var(--ink-muted)]">{t("mmkToThb")}</p>
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
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [baseRateDraft, setBaseRateDraft] = useState<string | null>(null);
  const [thbToMmkSellingRateDraft, setThbToMmkSellingRateDraft] = useState<string | null>(null);
  const [mmkToThbBuyingRateDraft, setMmkToThbBuyingRateDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const current = trpc.exchangeRates.current.useQuery();
  const history = trpc.exchangeRates.history.useQuery();
  const createRate = trpc.exchangeRates.create.useMutation();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

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

  function resetDrafts() {
    setBaseRateDraft(null);
    setThbToMmkSellingRateDraft(null);
    setMmkToThbBuyingRateDraft(null);
    setError(null);
  }

  function openDialog() {
    resetDrafts();
    setSuccess(null);
    setIsClosing(false);
    setIsOpen(true);
  }

  function closeDialog(force = false) {
    if ((!force && createRate.isPending) || isClosing) return;

    const finish = () => {
      resetDrafts();
      setIsOpen(false);
      setIsClosing(false);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(finish, 180);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSuccess(null);

    try {
      const effectiveAt = getYangonDateTime();
      await createRate.mutateAsync({
        baseRate,
        effectiveAt: toYangonIso(effectiveAt.date, effectiveAt.time),
        mmkToThbBuyingRate,
        note: String(form.get("note") ?? "").trim() || undefined,
        thbToMmkSellingRate,
      });
      await Promise.all([current.refetch(), history.refetch()]);
      setBaseRateDraft(null);
      setThbToMmkSellingRateDraft(null);
      setMmkToThbBuyingRateDraft(null);
      setSuccess(t("rateSaved"));
      closeDialog(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("unableToSaveRate");
      setError(rateErrorMessage(message));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-5 border-b border-[var(--hairline)] pb-5">
        <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {t("exchangeRate")}
        </h1>
        <Button onClick={openDialog}>{t("newRate")}</Button>
      </header>

      {success ? (
        <p
          className="border-l-4 border-[var(--success)] bg-[#e8f8f0] px-5 py-4 text-sm"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <section
        aria-labelledby="current-rate-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] px-5 py-4 sm:px-7">
          <h2 id="current-rate-heading" className="text-lg font-semibold text-[var(--ink)]">
            {t("currentRate")}
          </h2>
          {current.data ? (
            <p className="text-xs text-[var(--ink-muted)]">
              {formatYangonDateTime(current.data.effectiveAt)}
            </p>
          ) : null}
        </div>

        {current.isLoading ? (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]" role="status">
            {t("loading")}
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
              <RateCell label={t("baseRate")} value={formatRate(current.data.baseRate)} />
              <RateCell
                label={`${t("thbToMmk")} · ${t("sellRate")}`}
                value={formatRate(current.data.thbToMmkCustomerRate)}
              />
              <RateCell
                label={`${t("mmkToThb")} · ${t("buyRate")}`}
                value={formatRate(current.data.mmkToThbCustomerRate)}
              />
            </div>
            <ProfitStrip
              buyingProfit={currentConfiguration.mmkToThbProfitPerHundredThousand}
              sellingProfit={currentConfiguration.thbToMmkProfitPerHundredThousand}
            />
          </>
        ) : null}
      </section>

      <section
        aria-labelledby="rate-history-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="border-b border-[var(--hairline)] px-5 py-4 sm:px-7">
          <h2 id="rate-history-heading" className="text-lg font-semibold text-[var(--ink)]">
            {t("rateHistory")}
          </h2>
        </div>
        {history.isLoading ? (
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]">{t("loading")}</p>
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
                      <p className="mt-1 text-[10px] font-semibold text-[var(--primary)]">
                        {t("active")}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
                    <div>
                      <p className="text-[var(--ink-muted)]">{t("baseRate")}</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.baseRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">{t("thbToMmk")}</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.thbToMmkCustomerRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">{t("mmkToThb")}</p>
                      <p className="mt-1 font-semibold text-[var(--ink)]">
                        {formatRate(rate.mmkToThbCustomerRate)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--ink-muted)]">
                        {t("thbToMmk")} {t("profit")}
                      </p>
                      <p className="mt-1 font-semibold tabular-nums text-[var(--ink)]">
                        {formatProfit(rateConfiguration.thbToMmkProfitPerHundredThousand)} THB
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--ink-muted)]">
                        {t("mmkToThb")} {t("profit")}
                      </p>
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
          <p className="px-5 py-8 text-sm text-[var(--ink-muted)]">{t("noHistory")}</p>
        )}
      </section>

      <dialog
        aria-labelledby="new-rate-title"
        aria-modal="true"
        className={`${isClosing ? "motion-closing " : ""}motion-dialog m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-white p-0 text-[var(--ink-slate)] backdrop:bg-[#00153c]/55 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh_-_3rem)] sm:w-[calc(100vw_-_3rem)] sm:max-w-[720px] sm:border sm:border-[var(--hairline)]`}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClose={() => {
          setIsOpen(false);
          setIsClosing(false);
        }}
        ref={dialogRef}
      >
        <div className="flex h-dvh flex-col bg-white sm:h-auto sm:max-h-[calc(100dvh_-_3rem)]">
          <header className="flex shrink-0 items-center justify-between gap-5 border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
                {t("exchangeRate")}
              </p>
              <h2
                className="mt-1 font-[var(--font-display)] text-xl font-medium text-[var(--ink)]"
                id="new-rate-title"
              >
                {t("newRate")}
              </h2>
            </div>
            <button
              aria-label={`${t("close")} ${t("newRate")}`}
              className="grid size-10 shrink-0 place-items-center rounded-[4px] border border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={createRate.isPending}
              onClick={() => closeDialog()}
              title={t("close")}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isOpen ? (
              <form onSubmit={submit}>
                <div className="grid gap-5 p-5 pt-8 sm:p-7 sm:pt-9">
                  <Field label={t("baseRate")}>
                    <Input
                      autoFocus
                      disabled={createRate.isPending}
                      inputMode="decimal"
                      onChange={(event) => setBaseRateDraft(event.target.value)}
                      placeholder="0.00748"
                      required
                      value={baseRate}
                    />
                  </Field>
                  <Field label={`${t("thbToMmk")} · ${t("sellRate")}`}>
                    <Input
                      disabled={createRate.isPending}
                      inputMode="decimal"
                      onChange={(event) => setThbToMmkSellingRateDraft(event.target.value)}
                      placeholder="0.00765"
                      required
                      value={thbToMmkSellingRate}
                    />
                  </Field>
                  <Field label={`${t("mmkToThb")} · ${t("buyRate")}`}>
                    <Input
                      disabled={createRate.isPending}
                      inputMode="decimal"
                      onChange={(event) => setMmkToThbBuyingRateDraft(event.target.value)}
                      placeholder="0.00740"
                      required
                      value={mmkToThbBuyingRate}
                    />
                  </Field>
                  <Field label={t("noteOptional")}>
                    <Input disabled={createRate.isPending} maxLength={500} name="note" />
                  </Field>
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
                <div className="sticky bottom-0 flex justify-end border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:px-7">
                  <Button disabled={createRate.isPending || !configuration.value} type="submit">
                    {createRate.isPending ? (
                      <>
                        <LoadingSpinner className="mr-2" />
                        {t("saving")}
                      </>
                    ) : (
                      t("save")
                    )}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </dialog>
    </div>
  );
}
