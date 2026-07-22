import type { Metadata } from "next";

import { RateSettings } from "./rate-settings";

export const metadata: Metadata = {
  title: "ငွေလဲနှုန်း သတ်မှတ်ရန် · Exchange rate settings",
};

export default function ExchangeRateSettingsPage() {
  return (
    <div className="space-y-8">
      <header className="grid gap-4 border-b border-[var(--hairline)] pb-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
            Rate desk
          </p>
          <h1 className="mt-3 font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
            ငွေလဲနှုန်း သတ်မှတ်ရန်
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Exchange rate settings</p>
        </div>
        <p className="max-w-[54ch] text-sm leading-6 text-[var(--ink-secondary)] lg:text-right">
          နှုန်းတစ်ခုသည် နောက်နှုန်းအသစ် မစတင်မချင်း ဆက်လက်အသုံးပြုမည်။ · A rate remains active
          until a newer version starts.
        </p>
      </header>
      <RateSettings />
    </div>
  );
}
