import type { Metadata } from "next";

import { RateSettings } from "./rate-settings";

export const metadata: Metadata = {
  title: "Exchange Rate",
};

export default function ExchangeRateSettingsPage() {
  return <RateSettings />;
}
