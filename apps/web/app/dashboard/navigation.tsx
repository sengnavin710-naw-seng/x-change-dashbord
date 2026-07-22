"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { english: "Overview", href: "/dashboard", index: "01", myanmar: "ခြုံငုံကြည့်ရန်" },
  { english: "Exchange", href: "/dashboard/exchange", index: "02", myanmar: "ငွေလဲလှယ်မှု" },
  {
    english: "Exchange rates",
    href: "/dashboard/exchange-rates",
    index: "03",
    myanmar: "ငွေလဲနှုန်း သတ်မှတ်ရန်",
  },
  { english: "Cash ↔ Bank", href: "/dashboard/cash-bank", index: "04", myanmar: "ငွေသား ↔ ဘဏ်" },
  { english: "Expenses", href: "/dashboard/expenses", index: "05", myanmar: "ကုန်ကျစရိတ်" },
  { english: "Summary", href: "/dashboard/summary", index: "06", myanmar: "စာရင်းချုပ်" },
  {
    english: "Reconciliation",
    href: "/dashboard/reconciliation",
    index: "07",
    myanmar: "စာရင်းညှိနှိုင်း",
  },
] as const;

export function DashboardNavigation({ mobile = false }: Readonly<{ mobile?: boolean }>) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className={mobile ? "grid gap-1" : "space-y-1"}>
      {navigation.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`grid grid-cols-[30px_minmax(0,1fr)] items-center border-l-2 px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset ${
              active
                ? "border-[var(--primary)] bg-[var(--surface-2)] text-[var(--ink)]"
                : "border-transparent text-[var(--ink-secondary)] hover:border-[var(--hairline-soft)] hover:bg-white"
            }`}
            href={item.href}
            key={item.href}
          >
            <span className="text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)]">
              {item.index}
            </span>
            <span>
              <span className="block text-sm font-semibold leading-5">{item.myanmar}</span>
              <span className="block text-[11px] leading-4 text-[var(--ink-muted)]">
                {item.english}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
