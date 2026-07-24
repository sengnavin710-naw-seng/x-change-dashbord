import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ date?: string | string[] }> }>) {
  return <RecordsPage searchParams={searchParams} type="expense" />;
}
