"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import type { AppRouter } from "@repo/api";
import { Button } from "@repo/ui/button";

import { formatYangonDateTime } from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

import { SingleDateFilter } from "./single-date-filter";

type DashboardData = inferRouterOutputs<AppRouter>["dashboard"]["today"];

export type ProfitDatePreset =
  "custom" | "last-month" | "this-month" | "this-week" | "today" | "yesterday";

export interface ProfitDateFilterValue {
  fromDate: string;
  preset: ProfitDatePreset;
  toDate: string;
}

function formatMoney(value: string | null | undefined, currency: "MMK" | "THB") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

function profitHeading(preset: ProfitDatePreset) {
  if (preset === "today") return "Today’s Profit";
  if (preset === "yesterday") return "Yesterday’s Profit";
  if (preset === "this-week") return "This Week’s Profit";
  if (preset === "last-month") return "Last Month’s Profit";
  if (preset === "custom") return "Selected Period Profit";
  return "This Month’s Profit";
}

function dashboardHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

const filterButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60";

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
  label: string;
  value: Exclude<ProfitDatePreset, "custom">;
}> = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "this-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
];

function ProfitDateFilter({
  maximumDate,
  value,
}: Readonly<{ maximumDate: string; value: ProfitDateFilterValue }>) {
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
    if (preset === "this-month") {
      params.delete("profitRange");
    } else {
      params.set("profitRange", preset);
    }
    params.delete("profitFrom");
    params.delete("profitTo");
    setIsOpen(false);
    startTransition(() => {
      router.push(dashboardHref(params));
    });
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromDate || !toDate) {
      setError("Select both start and end dates.");
      return;
    }
    if (fromDate > toDate) {
      setError("Start date must be before or the same as end date.");
      return;
    }
    if (toDate > maximumDate) {
      setError("End date cannot be later than today.");
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("profitRange", "custom");
    params.set("profitFrom", fromDate);
    params.set("profitTo", toDate);
    setError(null);
    setIsOpen(false);
    startTransition(() => {
      router.push(dashboardHref(params));
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls="profit-date-filter"
        aria-expanded={isOpen}
        className={filterButtonClass}
        disabled={isPending}
        onClick={toggleFilter}
        ref={triggerRef}
        type="button"
      >
        <CalendarIcon />
        Filter Date
      </button>

      {isOpen ? (
        <div
          aria-label="Profit date filter"
          className="absolute top-full right-0 z-30 mt-2 w-[600px] max-w-[calc(100vw-2rem)] border border-[var(--hairline)] bg-white shadow-[0_12px_32px_rgba(0,21,60,0.12)]"
          id="profit-date-filter"
          role="dialog"
        >
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ink)]">Date Filter</p>
          </div>
          <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="border-b border-[var(--hairline)] sm:border-r sm:border-b-0">
              {profitDatePresets.map((preset) => {
                const active = value.preset === preset.value;
                return (
                  <button
                    aria-pressed={active}
                    className={`min-h-11 w-full border-b border-[var(--hairline)] px-4 py-2 text-left text-sm font-semibold transition-colors last:border-b-0 ${
                      active
                        ? "bg-[var(--surface-2)] text-[var(--primary-dark)]"
                        : "bg-white text-[var(--ink-secondary)] hover:bg-[var(--canvas)]"
                    }`}
                    disabled={isPending}
                    key={preset.value}
                    onClick={() => applyPreset(preset.value)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <form className="space-y-4 p-4 sm:p-5" onSubmit={applyCustomRange}>
              <p
                className={`text-xs font-semibold ${
                  value.preset === "custom" ? "text-[var(--primary-dark)]" : "text-[var(--ink)]"
                }`}
              >
                Custom Range
              </p>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                  Start Date
                </span>
                <input
                  className="h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]"
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
                <span className="text-xs font-semibold text-[var(--ink-secondary)]">End Date</span>
                <input
                  className="h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]"
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
                className="h-10 w-full rounded-none border border-[var(--primary-dark)] bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                Apply
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function transactionLabel(type: "cash-bank" | "exchange" | "expense") {
  if (type === "exchange") return "Exchange";
  if (type === "cash-bank") return "Cash ↔ Bank";
  return "Expenses";
}

export function OverviewDashboard({
  date,
  initialDashboard,
  maximumDate,
  profitFilter,
}: Readonly<{
  date: string;
  initialDashboard: DashboardData;
  maximumDate: string;
  profitFilter: ProfitDateFilterValue;
}>) {
  const { data: dashboard } = trpc.dashboard.today.useQuery(
    {
      date,
      profitFromDate: profitFilter.fromDate,
      profitToDate: profitFilter.toDate,
    },
    {
      initialData: initialDashboard,
      refetchOnWindowFocus: "always",
    },
  );
  const metrics = [
    {
      currency: "THB" as const,
      label: "Exchange Profit (THB)",
      value: dashboard.totals.exchangeFormulaProfitThb,
    },
    {
      currency: "THB" as const,
      label: "Cash / Bank Profit (THB)",
      value: dashboard.totals.cashBankFeeThb,
    },
    {
      currency: "MMK" as const,
      label: "Cash / Bank Profit (MMK)",
      value: dashboard.totals.cashBankFeeMmk,
    },
    {
      currency: "THB" as const,
      label: "Expenses (THB)",
      value: dashboard.totals.expensesThb,
    },
    {
      currency: "MMK" as const,
      label: "Expenses (MMK)",
      value: dashboard.totals.expensesMmk,
    },
  ];
  return (
    <div className="space-y-7">
      {!dashboard.balanceConfiguration ? (
        <section
          className="border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-5"
          role="status"
        >
          <p className="font-semibold text-[var(--ink)]">Balance setup is not configured</p>
          <p className="mt-3 max-w-[760px] text-sm leading-6 text-[var(--ink-secondary)]">
            Set the Opening Balance and Previous Closing Balance before recording transactions.
          </p>
          <Link
            className="mt-4 inline-block text-sm font-semibold text-[var(--primary-dark)] underline underline-offset-4"
            href="/dashboard/balances"
          >
            Set Up Balances
          </Link>
        </section>
      ) : null}

      <section
        aria-labelledby="profit-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <h1 className="font-semibold text-[var(--ink)]" id="profit-heading">
            {profitHeading(profitFilter.preset)}
          </h1>
          <ProfitDateFilter maximumDate={maximumDate} value={profitFilter} />
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-[var(--hairline)] p-6 sm:border-r sm:border-b-0 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">Profit (THB)</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.profitForRange.thb, "THB")}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">Profit (MMK)</p>
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
            Current Exchange Balance
          </h2>
          <SingleDateFilter
            ariaLabel="Current exchange balance date filter"
            date={date}
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
            Summary
          </h2>
          <SingleDateFilter
            ariaLabel="Summary date filter"
            date={date}
            filterId="summary-date-filter"
            maximumDate={maximumDate}
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
            Latest Transactions
          </h2>
          <Link
            className="text-xs font-semibold text-[var(--primary-dark)] hover:underline"
            href="/dashboard/transactions"
          >
            View All
          </Link>
        </div>

        {dashboard.latestTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">No transactions yet.</p>
            <Button asChild className="mt-6" size="sm">
              <Link href="/dashboard/new">Add Transaction</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--hairline)]">
            {dashboard.latestTransactions.map((transaction) => {
              const label = transactionLabel(transaction.type);
              return (
                <article
                  className="grid gap-4 px-5 py-4 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-center sm:px-6"
                  key={`${transaction.type}-${transaction.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
                    <p className="mt-1 text-[10px] tabular-nums text-[var(--ink-muted)]">
                      {formatYangonDateTime(transaction.transactionAt)}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--ink-secondary)]">
                    {transaction.description || "-"}
                  </p>
                  <div className="text-left sm:text-right">
                    {transaction.type === "exchange" ? (
                      <>
                        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {formatMoney(
                            transaction.sourceAmount,
                            transaction.direction === "thb-to-mmk" ? "THB" : "MMK",
                          )}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                          Profit {formatMoney(transaction.formulaProfitThb, "THB")} THB
                        </p>
                      </>
                    ) : transaction.type === "cash-bank" ? (
                      <>
                        <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {formatMoney(transaction.principalAmount, transaction.currency)}{" "}
                          {transaction.currency}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                          Fee {formatMoney(transaction.feeAmount, transaction.currency)}{" "}
                          {transaction.currency}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                        {formatMoney(transaction.amount, transaction.currency)}{" "}
                        {transaction.currency}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
