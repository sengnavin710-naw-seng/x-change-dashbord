import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "ငွေသား ↔ ဘဏ် · Cash ↔ Bank" };

export default function CashBankPage() {
  return (
    <RecordsPage
      description="Bank In → Cash Out နှင့် Cash In → Bank Out ကို တစ်ကြောင်းစီအဖြစ် မှတ်တမ်းတင်ထားသော ယနေ့စာရင်းများ။"
      english="Cash ↔ Bank"
      myanmar="ငွေသား ↔ ဘဏ်"
      type="cash-bank"
    />
  );
}
