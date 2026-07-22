"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationIconName =
  "balance" | "bank" | "exchange" | "expenses" | "overview" | "rate" | "summary" | "transactions";

function NavigationIcon({ name }: Readonly<{ name: NavigationIconName }>) {
  const paths = {
    balance: (
      <>
        <path d="M12 4v16M7 20h10M5 7h14" />
        <path d="m7 7-4 6h8L7 7Zm10 0-4 6h8l-4-6Z" />
      </>
    ),
    bank: (
      <>
        <path d="M3 9h18M5 9v8m4-8v8m6-8v8m4-8v8M3 19h18" />
        <path d="m12 4 9 4H3l9-4Z" />
      </>
    ),
    exchange: (
      <>
        <path d="M4 8h14m0 0-3-3m3 3-3 3" />
        <path d="M20 16H6m0 0 3 3m-3-3 3-3" />
      </>
    ),
    expenses: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6m-6 4h6m-6 4h3" />
      </>
    ),
    overview: (
      <>
        <rect height="6" rx="1" width="6" x="4" y="4" />
        <rect height="6" rx="1" width="6" x="14" y="4" />
        <rect height="6" rx="1" width="6" x="4" y="14" />
        <rect height="6" rx="1" width="6" x="14" y="14" />
      </>
    ),
    rate: (
      <>
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="m6 18 12-12" />
      </>
    ),
    summary: <path d="M4 19h16M6 16v-5m6 5V5m6 11V8" />,
    transactions: (
      <>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <circle cx="4" cy="6" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="18" r="1" />
      </>
    ),
  } satisfies Record<NavigationIconName, React.ReactNode>;

  return (
    <svg
      aria-hidden="true"
      className="size-[17px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

const navigation = [
  {
    label: "Dashboard",
    items: [
      { href: "/dashboard", icon: "overview", label: "Overview" },
      { href: "/dashboard/summary", icon: "summary", label: "Summary" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { href: "/dashboard/exchange", icon: "exchange", label: "Exchange" },
      { href: "/dashboard/cash-bank", icon: "bank", label: "Cash ↔ Bank" },
      { href: "/dashboard/expenses", icon: "expenses", label: "Expenses" },
      {
        href: "/dashboard/transactions",
        icon: "transactions",
        label: "All Transactions",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/exchange-rates", icon: "rate", label: "Exchange Rate" },
      {
        href: "/dashboard/balances",
        icon: "balance",
        label: "Opening / Closing Balance",
      },
    ],
  },
] as const;

export function DashboardNavigation({ mobile = false }: Readonly<{ mobile?: boolean }>) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className={mobile ? "space-y-4" : "space-y-6"}>
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.14em] text-[var(--ink-secondary)] uppercase">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 border-l-2 px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset ${
                    active
                      ? "border-[var(--primary)] bg-[var(--surface-2)] text-[var(--ink)]"
                      : "border-transparent text-[var(--ink-secondary)] hover:border-[var(--hairline-soft)] hover:bg-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <NavigationIcon name={item.icon} />
                  <span className="text-sm font-semibold leading-5">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
