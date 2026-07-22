import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "ကုန်ကျစရိတ် · Expenses" };

export default function ExpensesPage() {
  return (
    <RecordsPage
      description="အမြတ်နှင့် မပေါင်းဘဲ THB နှင့် MMK အလိုက် သီးခြားပြထားသော ယနေ့ ကုန်ကျစရိတ်များ။"
      english="Expenses"
      myanmar="ကုန်ကျစရိတ်"
      type="expense"
    />
  );
}
