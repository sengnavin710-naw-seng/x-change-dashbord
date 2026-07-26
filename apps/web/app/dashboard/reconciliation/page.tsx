import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { BalanceConfigurationDialog } from "./balance-configuration-dialog";
import { getServerTranslator } from "../../../lib/i18n-server";

export const metadata: Metadata = { title: "Balance Setup" };

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
  const { t } = await getServerTranslator();
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const today = todayInYangon();
  const dashboard = await caller.dashboard.today({ date: today });
  const configuration = dashboard.balanceConfiguration;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-[var(--hairline)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
            {t("balanceSetup")}
          </h1>
        </div>
        <BalanceConfigurationDialog
          defaultCheckpointDate={configuration?.checkpointDate ?? previousCalendarDate(today)}
          initial={configuration}
        />
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <ReferenceBalanceCard
          label={t("openingBalance")}
          mmk={configuration ? formatMoney(configuration.openingMmk, "MMK") : "—"}
          thb={configuration ? formatMoney(configuration.openingThb, "THB") : "—"}
        />
        <ReferenceBalanceCard
          {...(configuration ? { date: configuration.checkpointDate } : {})}
          label={t("currencyExchangeBalance")}
          mmk={configuration ? formatMoney(configuration.checkpointMmk, "MMK") : "—"}
          thb={configuration ? formatMoney(configuration.checkpointThb, "THB") : "—"}
        />
      </section>
    </div>
  );
}

function ReferenceBalanceCard({
  date,
  label,
  mmk,
  thb,
}: Readonly<{ date?: string; label: string; mmk: string; thb: string }>) {
  return (
    <article className="border border-[var(--hairline)] bg-white">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-[var(--ink)]">{label}</h2>
        {date ? (
          <p className="shrink-0 text-[10px] font-semibold tracking-[0.06em] text-[var(--ink-muted)] uppercase">
            {date}
          </p>
        ) : null}
      </header>
      <div className="grid sm:grid-cols-2">
        <div className="min-w-0 px-5 py-6 sm:px-6">
          <p className="text-xs font-semibold text-[var(--ink-muted)]">THB</p>
          <p className="mt-3 overflow-hidden text-[clamp(1.45rem,3vw,2.25rem)] leading-none font-medium tracking-[-0.03em] text-ellipsis tabular-nums text-[var(--ink)]">
            {thb}
          </p>
        </div>
        <div className="min-w-0 border-t border-[var(--hairline)] px-5 py-6 sm:border-t-0 sm:border-l sm:px-6">
          <p className="text-xs font-semibold text-[var(--ink-muted)]">MMK</p>
          <p className="mt-3 overflow-hidden text-[clamp(1.45rem,3vw,2.25rem)] leading-none font-medium tracking-[-0.03em] text-ellipsis tabular-nums text-[var(--ink)]">
            {mmk}
          </p>
        </div>
      </div>
    </article>
  );
}
