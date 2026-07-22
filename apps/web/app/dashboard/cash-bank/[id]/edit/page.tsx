import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { EditCashBankForm } from "./edit-cash-bank-form";

export const metadata: Metadata = { title: "Edit Cash ↔ Bank" };

export default async function EditCashBankPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const record = await caller.operations.getCashBank({ id });

  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          Retrospective edit
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium text-[var(--ink)] sm:text-4xl">
          Edit Cash ↔ Bank
        </h1>
      </header>
      <div className="max-w-[780px] border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-4 text-sm leading-6 text-[var(--ink-secondary)]">
        The reason is preserved and today&apos;s Summary is recalculated.
      </div>
      <EditCashBankForm record={record} />
    </div>
  );
}
