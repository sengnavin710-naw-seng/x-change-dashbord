import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

export const metadata: Metadata = { title: "စာရင်းချုပ် · Summary" };

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

function format(value: string, currency: "MMK" | "THB") {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

export default async function SummaryPage() {
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const date = todayInYangon();
  const dashboard = await caller.dashboard.today({ date });
  const rows = [
    ["ဖော်မြူလာအရ FX အမြတ်", "FX formula profit", "THB", dashboard.totals.exchangeFormulaProfitThb],
    ["ဘတ် ဝန်ဆောင်ခဝင်ငွေ", "THB service fees", "THB", dashboard.totals.cashBankFeeThb],
    ["ကျပ် ဝန်ဆောင်ခဝင်ငွေ", "MMK service fees", "MMK", dashboard.totals.cashBankFeeMmk],
    ["ဘတ် ကုန်ကျစရိတ်", "THB expenses", "THB", dashboard.totals.expensesThb],
    ["ကျပ် ကုန်ကျစရိတ်", "MMK expenses", "MMK", dashboard.totals.expensesMmk],
  ] as const;

  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          Daily summary
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          ယနေ့ စာရင်းချုပ်
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          {date} · Profit and expenses remain separate
        </p>
      </header>
      <section className="border border-[var(--hairline)] bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_110px_150px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold text-[var(--ink-muted)] uppercase sm:px-6">
          <span>Category</span>
          <span>Currency</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {rows.map(([myanmar, english, currency, value]) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_110px_150px] items-center px-5 py-4 sm:px-6"
              key={english}
            >
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{myanmar}</p>
                <p className="mt-1 text-[10px] text-[var(--ink-muted)] uppercase">{english}</p>
              </div>
              <span className="text-xs font-semibold text-[var(--ink-muted)]">{currency}</span>
              <span className="text-right font-semibold tabular-nums text-[var(--ink)]">
                {format(value, currency)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="border-l-4 border-[var(--warning)] bg-[#fff8df] px-4 py-3 text-xs leading-5 text-[var(--ink-secondary)]">
        H, I နှင့် အဝါရောင် Summary ကော်လံများကို အဓိပ္ပာယ်မသေချာသေးသောကြောင့် ဤစာရင်းချုပ်တွင်
        မထည့်ထားပါ။ / Unresolved legacy columns H, I, and the yellow band are excluded.
      </p>
    </div>
  );
}
