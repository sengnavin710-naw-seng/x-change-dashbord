import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { EditExchangeForm } from "./edit-exchange-form";

export const metadata: Metadata = { title: "ငွေလဲစာရင်း ပြင်ရန် · Edit exchange" };

export default async function EditExchangePage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const record = await caller.operations.getExchange({ id });

  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          Retrospective edit
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          ငွေလဲစာရင်း ပြင်ရန်
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">Edit exchange transaction</p>
      </header>
      <div className="max-w-[780px] border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-4 text-sm leading-6 text-[var(--ink-secondary)]">
        ဤပြင်ဆင်မှုသည် နောက်ပိုင်း Closing Balance အားလုံးကို ပြန်လည်တွက်ချက်စေမည်။ / This edit
        recalculates every later closing balance. The previous values remain in revision history.
      </div>
      <EditExchangeForm record={record} />
    </div>
  );
}
