import type { Metadata } from "next";

import { RateSettings } from "./rate-settings";

export const metadata: Metadata = {
  title: "Exchange Rate",
};

export default function ExchangeRateSettingsPage() {
  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--hairline)] pb-5">
        <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          Exchange Rate
        </h1>
      </header>
      <RateSettings />
    </div>
  );
}
