import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "Cash ↔ Bank" };

export default function CashBankPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ date?: string | string[] }> }>) {
  return <RecordsPage searchParams={searchParams} type="cash-bank" />;
}
