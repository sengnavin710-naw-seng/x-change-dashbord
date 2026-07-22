import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "Exchange" };

export default function ExchangePage() {
  return <RecordsPage type="exchange" />;
}
