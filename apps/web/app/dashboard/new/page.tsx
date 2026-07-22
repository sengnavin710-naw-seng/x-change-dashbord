import type { Metadata } from "next";

import { EntryForm } from "./entry-form";
import { getYangonDateTime } from "@/lib/exchange-rate";

export const metadata: Metadata = {
  title: "New Entry",
};

export default function NewEntryPage() {
  const current = getYangonDateTime();
  return (
    <div className="space-y-7">
      <header className="border-b border-[var(--hairline)] pb-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
          Create record
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          New Entry
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">New operational entry</p>
      </header>
      <EntryForm defaultDate={current.date} defaultTime={current.time} />
    </div>
  );
}
