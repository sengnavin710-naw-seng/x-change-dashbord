import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { OpeningBalanceForm } from "./opening-form";

export const metadata: Metadata = { title: "စာရင်းညှိနှိုင်း · Reconciliation" };

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

function format(value: string) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(value));
}

export default async function ReconciliationPage() {
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const today = todayInYangon();
  const dashboard = await caller.dashboard.today({ date: today });

  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          Reconciliation
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          စာရင်းညှိနှိုင်း
        </h1>
        <p className="mt-2 max-w-[720px] text-sm leading-6 text-[var(--ink-muted)]">
          Reference Opening နှင့် Operational Opening ကို Statement အတည်ပြုချက်မရမချင်း
          သီးခြားထားသည်။
        </p>
      </header>

      {dashboard.openingBalance ? (
        <section className="border border-[#e4c45f] bg-[#fff8df]">
          <div className="border-b border-[#e4c45f] px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold text-[#755700] uppercase">
              မညှိရသေး / Unreconciled
            </p>
            <p className="mt-2 text-sm text-[var(--ink-secondary)]">
              External evidence is still required before either set is marked as confirmed.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Reference THB", dashboard.openingBalance.referenceThb],
              ["Reference MMK", dashboard.openingBalance.referenceMmk],
              ["Operational THB", dashboard.openingBalance.operationalThb],
              ["Operational MMK", dashboard.openingBalance.operationalMmk],
            ].map(([label, value], index) => (
              <div
                className={`p-5 ${index > 0 ? "border-t border-[#e4c45f] sm:border-t-0 sm:border-l" : ""}`}
                key={label}
              >
                <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                  {label}
                </p>
                <p className="mt-3 text-xl font-semibold tabular-nums text-[var(--ink)]">
                  {format(value!)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <OpeningBalanceForm defaultDate={today} />
      )}

      <aside className="border-l-4 border-[var(--primary)] bg-[var(--surface-2)] px-5 py-5">
        <p className="font-semibold text-[var(--ink)]">လိုအပ်သော အထောက်အထား / Evidence required</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--ink-secondary)]">
          <li>• June closing balance</li>
          <li>• THB and MMK cash count</li>
          <li>• Bank statements and any pre-July conversion record</li>
        </ul>
      </aside>
    </div>
  );
}
