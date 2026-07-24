import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "Exchange" };

export default function ExchangePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ date?: string | string[] }> }>) {
  return <RecordsPage searchParams={searchParams} type="exchange" />;
}
