import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { BalanceConfigurationForm } from "./opening-form";

export const metadata: Metadata = { title: "Opening / Closing Balance" };

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

function previousCalendarDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function formatMoney(value: string, currency: "MMK" | "THB") {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

export default async function BalancePage() {
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const today = todayInYangon();
  const dashboard = await caller.dashboard.today({ date: today });
  const configuration = dashboard.balanceConfiguration;

  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          Opening / Closing Balance
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{today} · Today</p>
      </header>

      {configuration && dashboard.closingBalance ? (
        <>
          <section className="border border-[var(--hairline)] bg-white">
            <div className="flex items-center justify-between gap-5 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[var(--ink)]">Current Closing Balance</h2>
              <span className="text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase">
                {today}
              </span>
            </div>
            <div className="grid sm:grid-cols-2">
              <BalanceAmount
                currency="THB"
                value={formatMoney(dashboard.closingBalance.thb, "THB")}
              />
              <BalanceAmount
                currency="MMK"
                right
                value={formatMoney(dashboard.closingBalance.mmk, "MMK")}
              />
            </div>
          </section>

          <section className="border border-[var(--hairline)] bg-white">
            <div className="border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[var(--ink)]">Balance Reference</h2>
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_150px_180px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase sm:grid sm:px-6">
              <span>Balance</span>
              <span className="text-right">THB</span>
              <span className="text-right">MMK</span>
            </div>
            <BalanceReferenceRow
              label="Opening Balance"
              mmk={formatMoney(configuration.openingMmk, "MMK")}
              thb={formatMoney(configuration.openingThb, "THB")}
            />
            <BalanceReferenceRow
              date={configuration.checkpointDate}
              label="Previous Closing Balance"
              mmk={formatMoney(configuration.checkpointMmk, "MMK")}
              thb={formatMoney(configuration.checkpointThb, "THB")}
            />
          </section>

          <details className="max-w-[720px] border border-[var(--hairline)] bg-[#f4f7fb]">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset sm:px-7">
              Edit Balance Setup
            </summary>
            <div className="border-t border-[var(--hairline)] bg-[var(--canvas)] p-3 sm:p-5">
              <BalanceConfigurationForm
                defaultCheckpointDate={configuration.checkpointDate}
                initial={configuration}
              />
            </div>
          </details>
        </>
      ) : (
        <>
          <section className="border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-4">
            <p className="font-semibold text-[var(--ink)]">Balance setup is not configured</p>
          </section>
          <BalanceConfigurationForm
            defaultCheckpointDate={previousCalendarDate(today)}
            initial={null}
          />
        </>
      )}
    </div>
  );
}

function BalanceAmount({
  currency,
  right = false,
  value,
}: Readonly<{ currency: "MMK" | "THB"; right?: boolean; value: string }>) {
  return (
    <div
      className={`p-6 lg:p-8 ${right ? "border-t border-[var(--hairline)] sm:border-t-0 sm:border-l" : ""}`}
    >
      <p className="text-xs font-semibold text-[var(--ink-muted)]">{currency}</p>
      <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}

function BalanceReferenceRow({
  date,
  label,
  mmk,
  thb,
}: Readonly<{ date?: string; label: string; mmk: string; thb: string }>) {
  return (
    <div className="grid gap-4 border-b border-[var(--hairline)] px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_150px_180px] sm:items-center sm:px-6">
      <div>
        <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
        {date ? <p className="mt-1 text-[10px] text-[var(--ink-muted)]">{date}</p> : null}
      </div>
      <p className="text-sm font-semibold tabular-nums text-[var(--ink)] sm:text-right">
        <span className="mr-2 text-[10px] text-[var(--ink-muted)] sm:hidden">THB</span>
        {thb}
      </p>
      <p className="text-sm font-semibold tabular-nums text-[var(--ink)] sm:text-right">
        <span className="mr-2 text-[10px] text-[var(--ink-muted)] sm:hidden">MMK</span>
        {mmk}
      </p>
    </div>
  );
}
