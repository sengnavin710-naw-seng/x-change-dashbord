"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { AppRouter } from "@repo/api";
import { Button } from "@repo/ui/button";

import type { MessageKey } from "@/lib/i18n";
import { trpc } from "@/trpc/client";

import { useLanguage } from "../language-provider";
import { SingleDateFilter } from "./single-date-filter";

type DashboardData = inferRouterOutputs<AppRouter>["dashboard"]["today"];
type LatestTransaction = DashboardData["latestTransactions"][number];
type TransactionCurrency = "MMK" | "THB";

interface TransactionAmount {
  amount: string | null;
  currency: TransactionCurrency | null;
}

export type ProfitDatePreset =
  "custom" | "last-month" | "this-month" | "this-week" | "today" | "yesterday";

export interface ProfitDateFilterValue {
  fromDate: string;
  preset: ProfitDatePreset;
  toDate: string;
}

type DateFilterScope = "profit" | "summary";

const latestTransactionsGrid = "grid-cols-[150px_130px_160px_190px_190px_140px_90px]";

function formatMoney(value: string | null | undefined, currency: "MMK" | "THB") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

function profitFilterLabel(preset: ProfitDatePreset): MessageKey {
  if (preset === "today") return "today";
  if (preset === "yesterday") return "yesterday";
  if (preset === "this-week") return "thisWeek";
  if (preset === "last-month") return "lastMonth";
  if (preset === "custom") return "customRange";
  return "thisMonth";
}

function formatFilterDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function profitFilterButtonLabel(value: ProfitDateFilterValue, t: (key: MessageKey) => string) {
  if (value.preset !== "custom") return t(profitFilterLabel(value.preset));

  const fromDate = formatFilterDate(value.fromDate);
  const toDate = formatFilterDate(value.toDate);
  return fromDate === toDate ? fromDate : `${fromDate} – ${toDate}`;
}

function dashboardHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

const filterButtonClass =
  "inline-flex h-11 max-w-[10rem] items-center justify-center gap-2 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60 sm:h-9 sm:max-w-none";

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const profitDatePresets: ReadonlyArray<{
  label: MessageKey;
  value: Exclude<ProfitDatePreset, "custom">;
}> = [
  { label: "today", value: "today" },
  { label: "yesterday", value: "yesterday" },
  { label: "thisWeek", value: "this-week" },
  { label: "thisMonth", value: "this-month" },
  { label: "lastMonth", value: "last-month" },
];

function ProfitDateFilter({
  ariaLabel,
  filterId,
  maximumDate,
  scope,
  value,
}: Readonly<{
  ariaLabel: string;
  filterId: string;
  maximumDate: string;
  scope: DateFilterScope;
  value: ProfitDateFilterValue;
}>) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [fromDate, setFromDate] = useState(value.fromDate);
  const [toDate, setToDate] = useState(value.toDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggleFilter() {
    if (!isOpen) {
      setFromDate(value.fromDate);
      setToDate(value.toDate);
      setError(null);
    }
    setIsOpen(!isOpen);
  }

  function applyPreset(preset: Exclude<ProfitDatePreset, "custom">) {
    const params = new URLSearchParams(searchParams.toString());
    const rangeParameter = `${scope}Range`;
    const fromParameter = `${scope}From`;
    const toParameter = `${scope}To`;
    if (preset === "this-month") {
      params.delete(rangeParameter);
    } else {
      params.set(rangeParameter, preset);
    }
    params.delete(fromParameter);
    params.delete(toParameter);
    setIsOpen(false);
    startTransition(() => {
      router.push(dashboardHref(params));
    });
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromDate || !toDate) {
      setError(t("selectBothDates"));
      return;
    }
    if (fromDate > toDate) {
      setError(t("startDateBeforeEnd"));
      return;
    }
    if (toDate > maximumDate) {
      setError(t("endDateNotFuture"));
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set(`${scope}Range`, "custom");
    params.set(`${scope}From`, fromDate);
    params.set(`${scope}To`, toDate);
    setError(null);
    setIsOpen(false);
    startTransition(() => {
      router.push(dashboardHref(params));
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={filterId}
        aria-expanded={isOpen}
        className={filterButtonClass}
        disabled={isPending}
        onClick={toggleFilter}
        ref={triggerRef}
        type="button"
      >
        <CalendarIcon />
        <span className="truncate">{profitFilterButtonLabel(value, t)}</span>
      </button>

      {isOpen ? (
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-[rgba(0,21,60,0.18)] sm:hidden"
            onClick={() => setIsOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label={ariaLabel}
            className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 max-h-[min(78dvh,34rem)] overflow-y-auto overscroll-contain border border-[var(--hairline)] bg-white shadow-[0_12px_32px_rgba(0,21,60,0.16)] sm:absolute sm:top-full sm:right-0 sm:bottom-auto sm:left-auto sm:z-30 sm:mt-2 sm:max-h-[calc(100vh-8rem)] sm:w-[600px] sm:max-w-[calc(100vw-2rem)]"
            id={filterId}
            role="dialog"
          >
            <div className="flex min-h-11 items-center justify-between border-b border-[var(--hairline)] px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{t("dateFilter")}</p>
              <button
                aria-label={t("close")}
                className="inline-flex size-10 items-center justify-center border border-[var(--hairline-soft)] bg-white text-xl leading-none text-[var(--ink-secondary)] hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:hidden"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="grid grid-cols-2 border-b border-[var(--hairline)] sm:block sm:border-r sm:border-b-0">
                {profitDatePresets.map((preset) => {
                  const active = value.preset === preset.value;
                  return (
                    <button
                      aria-pressed={active}
                      className={`min-h-11 border-r border-b border-[var(--hairline)] px-3 py-2 text-left text-xs font-semibold transition-colors even:border-r-0 last:col-span-2 last:border-r-0 sm:w-full sm:border-r-0 sm:px-4 sm:text-sm sm:last:col-span-1 sm:last:border-b-0 ${
                        active
                          ? "bg-[var(--surface-2)] text-[var(--primary-dark)]"
                          : "bg-white text-[var(--ink-secondary)] hover:bg-[var(--canvas)]"
                      }`}
                      disabled={isPending}
                      key={preset.value}
                      onClick={() => applyPreset(preset.value)}
                      type="button"
                    >
                      {t(preset.label)}
                    </button>
                  );
                })}
              </div>
              <form className="space-y-3 p-3 sm:space-y-4 sm:p-5" onSubmit={applyCustomRange}>
                <p
                  className={`text-xs font-semibold ${
                    value.preset === "custom" ? "text-[var(--primary-dark)]" : "text-[var(--ink)]"
                  }`}
                >
                  {t("customRange")}
                </p>
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                    {t("startDate")}
                  </span>
                  <input
                    className="h-11 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2] sm:h-10"
                    max={maximumDate}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setError(null);
                    }}
                    required
                    type="date"
                    value={fromDate}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                    {t("endDate")}
                  </span>
                  <input
                    className="h-11 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2] sm:h-10"
                    max={maximumDate}
                    min={fromDate || undefined}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setError(null);
                    }}
                    required
                    type="date"
                    value={toDate}
                  />
                </label>
                {error ? (
                  <p className="text-xs leading-5 text-[#b42318]" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  className="h-11 w-full rounded-none border border-[var(--primary-dark)] bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:h-10"
                  disabled={isPending}
                  type="submit"
                >
                  {t("apply")}
                </button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function transactionTypeLabel(transaction: LatestTransaction, t: (key: MessageKey) => string) {
  if (transaction.type === "exchange") return t("exchange");
  if (transaction.type === "cash-bank") return t("cashBank");
  return t("expenses");
}

function transactionDirectionLabel(transaction: LatestTransaction, t: (key: MessageKey) => string) {
  if (transaction.type === "exchange") {
    return transaction.direction === "thb-to-mmk" ? "THB → MMK" : "MMK → THB";
  }
  if (transaction.type === "cash-bank") {
    return transaction.direction === "bank-to-cash" ? t("bankInCashOut") : t("cashInBankOut");
  }
  return "—";
}

function transactionDateTime(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "Asia/Yangon",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      timeZone: "Asia/Yangon",
    }).format(date),
  };
}

function transactionEditHref(transaction: LatestTransaction) {
  if (transaction.type === "exchange") return `/dashboard/exchange/${transaction.id}/edit`;
  if (transaction.type === "cash-bank") return `/dashboard/cash-bank/${transaction.id}/edit`;
  return `/dashboard/expenses/${transaction.id}/edit`;
}

function formatTransactionAmount({ amount, currency }: TransactionAmount) {
  if (amount === null || currency === null) return "—";

  return `${formatMoney(amount, currency)} ${currency}`;
}

function transactionAmounts(transaction: LatestTransaction): {
  inAmount: TransactionAmount;
  outAmount: TransactionAmount;
  profit: TransactionAmount;
} {
  if (transaction.type === "exchange") {
    return {
      inAmount: {
        amount: transaction.sourceAmount,
        currency: transaction.direction === "thb-to-mmk" ? "THB" : "MMK",
      },
      outAmount: {
        amount: transaction.actualPayout,
        currency: transaction.direction === "thb-to-mmk" ? "MMK" : "THB",
      },
      profit: {
        amount: transaction.formulaProfitThb,
        currency: "THB",
      },
    };
  }

  if (transaction.type === "cash-bank") {
    const isCashToBank = transaction.direction === "cash-to-bank";

    return {
      inAmount: {
        amount: isCashToBank ? transaction.cashIn : transaction.bankIn,
        currency: transaction.currency,
      },
      outAmount: {
        amount: isCashToBank ? transaction.bankOut : transaction.cashOut,
        currency: transaction.currency,
      },
      profit: {
        amount: transaction.feeAmount,
        currency: transaction.currency,
      },
    };
  }

  return {
    inAmount: { amount: null, currency: null },
    outAmount: {
      amount: transaction.amount,
      currency: transaction.currency,
    },
    profit: { amount: null, currency: null },
  };
}

export function OverviewDashboard({
  date,
  initialDashboard,
  maximumDate,
  profitFilter,
  summaryFilter,
}: Readonly<{
  date: string;
  initialDashboard: DashboardData;
  maximumDate: string;
  profitFilter: ProfitDateFilterValue;
  summaryFilter: ProfitDateFilterValue;
}>) {
  const { t } = useLanguage();
  const { data: dashboard } = trpc.dashboard.today.useQuery(
    {
      date,
      profitFromDate: profitFilter.fromDate,
      profitToDate: profitFilter.toDate,
      summaryFromDate: summaryFilter.fromDate,
      summaryToDate: summaryFilter.toDate,
    },
    {
      initialData: initialDashboard,
      refetchOnWindowFocus: "always",
    },
  );
  const metrics = [
    {
      currency: "THB" as const,
      label: t("exchangeProfitThb"),
      value: dashboard.summaryForRange.exchangeFormulaProfitThb,
    },
    {
      currency: "THB" as const,
      label: t("cashBankProfitThb"),
      value: dashboard.summaryForRange.cashBankFeeThb,
    },
    {
      currency: "MMK" as const,
      label: t("cashBankProfitMmk"),
      value: dashboard.summaryForRange.cashBankFeeMmk,
    },
    {
      currency: "THB" as const,
      label: t("expensesThb"),
      value: dashboard.summaryForRange.expensesThb,
    },
    {
      currency: "MMK" as const,
      label: t("expensesMmk"),
      value: dashboard.summaryForRange.expensesMmk,
    },
  ];
  return (
    <div className="space-y-7">
      <section
        aria-labelledby="profit-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <h1 className="font-semibold text-[var(--ink)]" id="profit-heading">
            {t("totalProfit")}
          </h1>
          <ProfitDateFilter
            ariaLabel={t("dateFilter")}
            filterId="profit-date-filter"
            maximumDate={maximumDate}
            scope="profit"
            value={profitFilter}
          />
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-[var(--hairline)] p-6 sm:border-r sm:border-b-0 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">{t("profitThb")}</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.profitForRange.thb, "THB")}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">{t("profitMmk")}</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.profitForRange.mmk, "MMK")}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="balance-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--ink)]" id="balance-heading">
            {t("currentExchangeBalance")}
          </h2>
          <SingleDateFilter
            ariaLabel={t("dateFilter")}
            date={date}
            displaySelectedDate
            filterId="balance-date-filter"
            maximumDate={maximumDate}
          />
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-[var(--hairline)] px-5 py-5 sm:border-r sm:border-b-0 sm:px-6">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">THB</p>
            <p className="mt-3 font-[var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] leading-none font-medium tracking-[-0.025em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.closingBalance?.thb, "THB")}
            </p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">MMK</p>
            <p className="mt-3 font-[var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] leading-none font-medium tracking-[-0.025em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.closingBalance?.mmk, "MMK")}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="metrics-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--ink)]" id="metrics-heading">
            {t("summaryDetails")}
          </h2>
          <ProfitDateFilter
            ariaLabel={t("dateFilter")}
            filterId="summary-date-filter"
            maximumDate={maximumDate}
            scope="summary"
            value={summaryFilter}
          />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <article
              className="min-h-[150px] border-b border-[var(--hairline)] bg-white p-5 last:border-b-0 sm:odd:border-r xl:border-r xl:border-b-0 xl:last:border-r-0"
              key={metric.label}
            >
              <p className="text-sm font-semibold leading-6 text-[var(--ink)]">{metric.label}</p>
              <p className="mt-7 font-[var(--font-display)] text-2xl font-medium tracking-[-0.02em] tabular-nums text-[var(--ink)]">
                {formatMoney(metric.value, metric.currency)}
                <span className="ml-2 text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)]">
                  {metric.currency}
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="recent-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-5 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--ink)]" id="recent-heading">
            {t("latestTransactions")}
          </h2>
          <Link
            className="text-xs font-semibold text-[var(--primary-dark)] hover:underline"
            href="/dashboard/transactions"
          >
            {t("viewAll")}
          </Link>
        </div>

        {dashboard.latestTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">{t("noTransactionsYet")}</p>
            <Button asChild className="mt-6" size="sm">
              <Link href="/dashboard/new">{t("addTransaction")}</Link>
            </Button>
          </div>
        ) : (
          <div
            aria-label={t("latestTransactions")}
            className="w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
            tabIndex={0}
          >
            <div className="min-w-[1090px]">
              <div
                className={`grid ${latestTransactionsGrid} items-center border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold tracking-[0.06em] whitespace-nowrap text-[var(--ink-muted)] uppercase`}
              >
                <span>{t("dateTime")}</span>
                <span>{t("type")}</span>
                <span>{t("direction")}</span>
                <span className="pr-2 text-right">{t("in")}</span>
                <span className="pr-2 text-right">{t("out")}</span>
                <span className="pr-2 text-right">{t("profit")}</span>
                <span className="pr-2 text-right">{t("action")}</span>
              </div>
              <div className="divide-y divide-[var(--hairline)]">
                {dashboard.latestTransactions.map((transaction) => {
                  const amounts = transactionAmounts(transaction);
                  const dateTime = transactionDateTime(transaction.transactionAt);
                  return (
                    <article
                      className={`grid ${latestTransactionsGrid} items-center px-5 py-4 text-sm`}
                      key={`${transaction.type}-${transaction.id}`}
                    >
                      <div className="tabular-nums">
                        <p className="font-semibold text-[var(--ink)]">{dateTime.date}</p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">{dateTime.time}</p>
                      </div>
                      <p className="font-semibold text-[var(--ink)]">
                        {transactionTypeLabel(transaction, t)}
                      </p>
                      <p className="pr-4 font-medium text-[var(--ink-secondary)]">
                        {transactionDirectionLabel(transaction, t)}
                      </p>
                      <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink)]">
                        {formatTransactionAmount(amounts.inAmount)}
                      </p>
                      <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink)]">
                        {formatTransactionAmount(amounts.outAmount)}
                      </p>
                      <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink-secondary)]">
                        {formatTransactionAmount(amounts.profit)}
                      </p>
                      <Link
                        className="justify-self-end pr-2 text-xs font-semibold text-[var(--primary-dark)] underline underline-offset-4"
                        href={transactionEditHref(transaction)}
                      >
                        {t("edit")}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
