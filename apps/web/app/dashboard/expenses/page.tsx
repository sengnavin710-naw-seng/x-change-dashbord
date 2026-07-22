import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return <RecordsPage type="expense" />;
}
