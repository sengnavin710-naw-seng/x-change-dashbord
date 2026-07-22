import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "Cash ↔ Bank" };

export default function CashBankPage() {
  return <RecordsPage type="cash-bank" />;
}
