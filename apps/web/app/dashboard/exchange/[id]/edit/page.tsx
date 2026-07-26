import type { Metadata } from "next";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { EditExchangeForm } from "./edit-exchange-form";
import { getServerTranslator } from "../../../../../lib/i18n-server";

export const metadata: Metadata = { title: "Edit Exchange" };

export default async function EditExchangePage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { t } = await getServerTranslator();
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const record = await caller.operations.getExchange({ id });

  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          {t("retrospectiveEdit")}
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {t("edit")} {t("exchange")}
        </h1>
      </header>
      <div className="max-w-[780px] border-l-4 border-[var(--warning)] bg-[#fff8df] px-5 py-4 text-sm leading-6 text-[var(--ink-secondary)]">
        {t("editRecalculatesBalances")}
      </div>
      <EditExchangeForm record={record} />
    </div>
  );
}
