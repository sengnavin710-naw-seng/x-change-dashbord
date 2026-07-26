import type { Metadata } from "next";

import { EntryForm } from "./entry-form";
import { getYangonDateTime } from "@/lib/exchange-rate";
import { getServerTranslator } from "../../../lib/i18n-server";

export const metadata: Metadata = {
  title: "Add Transaction",
};

export default async function NewEntryPage() {
  const { t } = await getServerTranslator();
  const current = getYangonDateTime();
  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          {t("new")}
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {t("addTransaction")}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{t("addTransaction")}</p>
      </header>
      <EntryForm defaultDate={current.date} defaultTime={current.time} />
    </div>
  );
}
