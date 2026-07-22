import type { Metadata } from "next";

import { RecordsPage } from "../records-page";

export const metadata: Metadata = { title: "ငွေလဲလှယ်မှု · Exchange" };

export default function ExchangePage() {
  return (
    <RecordsPage
      description="ဖော်မြူလာအရ အမြတ်နှင့် အမှန်တကယ်ပေးငွေကို သီးခြားသိမ်းထားသော ယနေ့ ငွေလဲစာရင်းများ။"
      english="Exchange"
      myanmar="ငွေလဲလှယ်မှု"
      type="exchange"
    />
  );
}
