import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { SingleDateFilter } from "../single-date-filter";

export const metadata: Metadata = { title: "Summary Details" };

function todayInYangon() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Yangon",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function selectedDate(value: string | string[] | undefined, today: string) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate) || candidate > today) {
    return today;
  }

  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate
    ? today
    : candidate;
}

function format(value: string, currency: "MMK" | "THB") {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

export default async function SummaryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ date?: string | string[] }> }>) {
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const today = todayInYangon();
  const date = selectedDate((await searchParams).date, today);
  const dashboard = await caller.dashboard.today({ date });
  const rows = [
    ["Exchange Profit", "THB", dashboard.totals.exchangeFormulaProfitThb],
    ["Cash / Bank Profit", "THB", dashboard.totals.cashBankFeeThb],
    ["Cash / Bank Profit", "MMK", dashboard.totals.cashBankFeeMmk],
    ["Expenses", "THB", dashboard.totals.expensesThb],
    ["Expenses", "MMK", dashboard.totals.expensesMmk],
  ] as const;

  return (
    <div className="space-y-7">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          Summary Details
        </h1>
        <SingleDateFilter
          ariaLabel="Summary date filter"
          date={date}
          filterId="summary-page-date-filter"
          maximumDate={today}
        />
      </header>
      <section className="border border-[var(--hairline)] bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_110px_150px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold text-[var(--ink-muted)] uppercase sm:px-6">
          <span>Category</span>
          <span>Currency</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {rows.map(([label, currency, value]) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_110px_150px] items-center px-5 py-4 sm:px-6"
              key={`${label}-${currency}`}
            >
              <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
              <span className="text-xs font-semibold text-[var(--ink-muted)]">{currency}</span>
              <span className="text-right font-semibold tabular-nums text-[var(--ink)]">
                {format(value, currency)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
