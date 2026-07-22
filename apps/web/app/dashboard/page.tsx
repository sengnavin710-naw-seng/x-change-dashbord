import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";
import { Button } from "@repo/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ယနေ့ လုပ်ငန်းအခြေအနေ · Today's operations",
};

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("my-MM", {
    dateStyle: "full",
    timeZone: "Asia/Yangon",
  }).format(new Date(`${date}T00:00:00+06:30`));
}

function formatMoney(value: string | null | undefined, currency: "MMK" | "THB") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

function transactionLabel(type: "cash-bank" | "exchange" | "expense") {
  if (type === "exchange") return { english: "Exchange", myanmar: "ငွေလဲလှယ်မှု" };
  if (type === "cash-bank") return { english: "Cash ↔ Bank", myanmar: "ငွေသား ↔ ဘဏ်" };
  return { english: "Expense", myanmar: "ကုန်ကျစရိတ်" };
}

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const caller = appRouter.createCaller(await createTRPCContext({ headers: requestHeaders }));
  const today = todayInYangon();
  const dashboard = await caller.dashboard.today({ date: today });

  const metrics = [
    {
      currency: "THB" as const,
      english: "FX formula profit",
      myanmar: "ဖော်မြူလာအရ FX အမြတ်",
      value: dashboard.totals.exchangeFormulaProfitThb,
    },
    {
      currency: "THB" as const,
      english: "THB service fees",
      myanmar: "ဘတ် ဝန်ဆောင်ခဝင်ငွေ",
      value: dashboard.totals.cashBankFeeThb,
    },
    {
      currency: "MMK" as const,
      english: "MMK service fees",
      myanmar: "ကျပ် ဝန်ဆောင်ခဝင်ငွေ",
      value: dashboard.totals.cashBankFeeMmk,
    },
    {
      currency: "THB" as const,
      english: "Expenses · THB",
      myanmar: "ကုန်ကျစရိတ် · ဘတ်",
      value: dashboard.totals.expensesThb,
    },
    {
      currency: "MMK" as const,
      english: "Expenses · MMK",
      myanmar: "ကုန်ကျစရိတ် · ကျပ်",
      value: dashboard.totals.expensesMmk,
    },
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-[var(--hairline)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
            Today · Asia/Yangon
          </p>
          <h1 className="mt-3 font-[var(--font-display)] text-[clamp(2rem,4vw,3.25rem)] leading-[1.08] font-medium tracking-[-0.035em] text-[var(--ink)]">
            ယနေ့ လုပ်ငန်းအခြေအနေ
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Today&apos;s operations</p>
          <p className="mt-4 text-sm font-medium text-[var(--ink-secondary)]">
            {formatDate(today)}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto lg:hidden">
          <Link href="/dashboard/new">စာရင်းအသစ် / New entry</Link>
        </Button>
      </header>

      {!dashboard.openingBalance ? (
        <section
          className="border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-5"
          role="status"
        >
          <p className="font-semibold text-[var(--ink)]">အဖွင့်လက်ကျန် မသတ်မှတ်ရသေးပါ</p>
          <p className="mt-1 text-xs font-medium text-[var(--ink-muted)]">
            Opening balance is not configured
          </p>
          <p className="mt-3 max-w-[760px] text-sm leading-6 text-[var(--ink-secondary)]">
            လုပ်ငန်းသုံး လက်ကျန်ကို မသတ်မှတ်မချင်း THB နှင့် MMK လက်ကျန်ကို ခန့်မှန်းပြသမည်မဟုတ်ပါ။
          </p>
          <Link
            className="mt-4 inline-block text-sm font-semibold text-[var(--primary-dark)] underline underline-offset-4"
            href="/dashboard/reconciliation"
          >
            စာရင်းညှိနှိုင်းရန် / Reconcile opening
          </Link>
        </section>
      ) : null}

      {dashboard.openingBalance && !dashboard.openingBalance.reconciled ? (
        <section
          className="grid border border-[#e4c45f] bg-[#fff8df] lg:grid-cols-[minmax(0,1fr)_auto]"
          role="status"
        >
          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#755700] uppercase">
              မညှိရသေး / Unreconciled
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">
              အဖွင့်လက်ကျန် နှစ်စုံကို သီးခြားထားပါသည်
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              Reference and operational openings remain separate until statement confirmation.
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-[#e4c45f] lg:border-t-0 lg:border-l">
            <div className="min-w-[150px] p-4 sm:p-5">
              <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                Reference THB
              </p>
              <p className="mt-2 font-[var(--font-display)] text-lg font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(dashboard.openingBalance.referenceThb, "THB")}
              </p>
            </div>
            <div className="min-w-[150px] border-l border-[#e4c45f] p-4 sm:p-5">
              <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                Reference MMK
              </p>
              <p className="mt-2 font-[var(--font-display)] text-lg font-medium tabular-nums text-[var(--ink)]">
                {formatMoney(dashboard.openingBalance.referenceMmk, "MMK")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="balance-heading"
        className="border border-[var(--hairline)] bg-white"
      >
        <div className="flex items-center justify-between gap-5 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold text-[var(--ink)]" id="balance-heading">
              လုပ်ငန်းသုံး လက်ကျန်
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Operational exchange float</p>
          </div>
          <span className="text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase">
            As of today
          </span>
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-[var(--hairline)] p-6 sm:border-r sm:border-b-0 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">ဘတ် / THB</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.balance?.thb, "THB")}
            </p>
          </div>
          <div className="p-6 lg:p-8">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">ကျပ် / MMK</p>
            <p className="mt-4 font-[var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.04em] tabular-nums text-[var(--ink)]">
              {formatMoney(dashboard.balance?.mmk, "MMK")}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="metrics-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--ink)]" id="metrics-heading">
              ယနေ့ စာရင်းချုပ်
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Today&apos;s verified categories</p>
          </div>
          <p className="hidden text-[10px] text-[var(--ink-muted)] sm:block">
            Profit and expenses remain separate
          </p>
        </div>
        <div className="grid border-t border-l border-[var(--hairline)] sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <article
              className="min-h-[150px] border-r border-b border-[var(--hairline)] bg-white p-5"
              key={metric.english}
            >
              <p className="text-sm font-semibold leading-6 text-[var(--ink)]">{metric.myanmar}</p>
              <p className="mt-1 text-[10px] font-medium text-[var(--ink-muted)] uppercase">
                {metric.english}
              </p>
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
              ယနေ့ နောက်ဆုံးစာရင်းများ
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Recent entries today</p>
          </div>
          <Link
            className="text-xs font-semibold text-[var(--primary-dark)] hover:underline"
            href="/dashboard/summary"
          >
            အားလုံးကြည့်ရန် / View all
          </Link>
        </div>

        {dashboard.recentTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">ယနေ့ စာရင်းမရှိသေးပါ</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              No entries have been recorded today.
            </p>
            <Button asChild className="mt-6" size="sm">
              <Link href="/dashboard/new">ပထမစာရင်း ထည့်ရန် / Add first entry</Link>
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
                    <p className="text-sm font-semibold text-[var(--ink)]">{label.myanmar}</p>
                    <p className="mt-1 text-[10px] text-[var(--ink-muted)] uppercase">
                      {label.english}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--ink-secondary)]">
                    {transaction.description || "မှတ်ချက်မရှိ / No description"}
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
                          Formula profit {formatMoney(transaction.formulaProfitThb, "THB")} THB
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
