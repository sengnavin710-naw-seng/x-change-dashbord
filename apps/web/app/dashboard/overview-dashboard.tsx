"use client";

import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api";
import { Button } from "@repo/ui/button";

import { formatYangonDateTime } from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

type DashboardData = inferRouterOutputs<AppRouter>["dashboard"]["today"];

function formatMoney(value: string | null | undefined, currency: "MMK" | "THB") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

function formatMonthRange(fromDate: string, toDate: string) {
  const fromDay = Number(fromDate.slice(8, 10));
  const toDay = Number(toDate.slice(8, 10));
  const monthAndYear = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "Asia/Yangon",
    year: "numeric",
  }).format(new Date(`${toDate}T00:00:00+06:30`));

  return fromDay === toDay ? `${fromDay} ${monthAndYear}` : `${fromDay}–${toDay} ${monthAndYear}`;
}

function transactionLabel(type: "cash-bank" | "exchange" | "expense") {
  if (type === "exchange") return "Exchange";
  if (type === "cash-bank") return "Cash ↔ Bank";
  return "Expenses";
}

export function OverviewDashboard({
  date,
  initialDashboard,
}: Readonly<{ date: string; initialDashboard: DashboardData }>) {
  const { data: dashboard } = trpc.dashboard.today.useQuery(
    { date },
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
        <div className="flex items-center justify-between gap-5 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <div>
            <h1 className="font-semibold text-[var(--ink)]" id="profit-heading">
              This Month&apos;s Profit
            </h1>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {formatMonthRange(
                dashboard.profitThisMonth.fromDate,
                dashboard.profitThisMonth.toDate,
              )}
            </p>
          </div>
          <span className="text-right text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase">
            Expenses excluded
          </span>
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-[var(--hairline)] p-6 sm:border-r sm:border-b-0 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">Profit (THB)</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.profitThisMonth.thb, "THB")}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">Profit (MMK)</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.profitThisMonth.mmk, "MMK")}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="balance-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-5 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold text-[var(--ink)]" id="balance-heading">
              Closing Balance
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Current exchange balance</p>
          </div>
          <span className="text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase">
            As of today
          </span>
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-[var(--hairline)] p-5 sm:border-r sm:border-b-0 sm:p-6">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">THB</p>
            <p className="mt-3 font-[var(--font-display)] text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-medium tracking-[-0.035em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.closingBalance?.thb, "THB")}
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">MMK</p>
            <p className="mt-3 font-[var(--font-display)] text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-medium tracking-[-0.035em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.closingBalance?.mmk, "MMK")}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="metrics-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--ink)]" id="metrics-heading">
              Today&apos;s Summary
            </h2>
          </div>
          <p className="hidden text-[10px] text-[var(--ink-muted)] sm:block">
            Profit and expenses remain separate
          </p>
        </div>
        <div className="grid border-t border-l border-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <article
              className="min-h-[150px] border-r border-b border-[var(--hairline)] bg-white p-5"
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
          <div>
            <h2 className="font-semibold text-[var(--ink)]" id="recent-heading">
              Recent Entries
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Recent entries today</p>
          </div>
          <Link
            className="text-xs font-semibold text-[var(--primary-dark)] hover:underline"
            href="/dashboard/transactions"
          >
            View All
          </Link>
        </div>

        {dashboard.recentTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">No entries for today</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              No entries have been recorded today.
            </p>
            <Button asChild className="mt-6" size="sm">
              <Link href="/dashboard/new">Add First Entry</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--hairline)]">
            {dashboard.recentTransactions.map((transaction) => {
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
                    {transaction.description || "No description"}
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
