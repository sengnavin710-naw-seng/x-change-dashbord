import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@repo/ui/button";

import { DashboardNavigation } from "./navigation";
import { SignOutButton } from "./sign-out-button";

interface AdminShellProps {
  children: ReactNode;
  user: {
    email: string;
    name: string;
  };
}

export function AdminShell({ children, user }: Readonly<AdminShellProps>) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-slate)]" lang="my">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[color:var(--canvas)/0.96] px-4 backdrop-blur sm:px-6 lg:hidden">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link className="flex items-center gap-3" href="/dashboard">
            <span className="grid size-9 place-items-center rounded-[4px] border border-[var(--primary-dark)] bg-[var(--primary)] text-sm font-semibold text-white">
              X
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.15px] text-[var(--ink)]">
                X—CHANGE
              </span>
              <span className="block text-[10px] text-[var(--ink-muted)]">Admin workspace</span>
            </span>
          </Link>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              မီနူး / Menu
            </summary>
            <div className="absolute right-0 mt-2 w-[min(88vw,340px)] border border-[var(--hairline)] bg-[var(--canvas)] p-3 shadow-[0_12px_32px_rgba(0,21,60,0.12)]">
              <DashboardNavigation mobile />
              <div className="mt-3 border-t border-[var(--hairline)] pt-3">
                <SignOutButton />
              </div>
            </div>
          </details>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-[var(--hairline)] bg-[#f4f7fb] lg:flex lg:flex-col">
        <Link
          className="flex h-[82px] items-center gap-3 border-b border-[var(--hairline)] px-6"
          href="/dashboard"
        >
          <span className="grid size-10 place-items-center rounded-[4px] border border-[var(--primary-dark)] bg-[var(--primary)] text-sm font-semibold text-white">
            X
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[-0.15px] text-[var(--ink)]">
              X—CHANGE
            </span>
            <span className="block text-[10px] text-[var(--ink-muted)]">Admin workspace</span>
          </span>
        </Link>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.12em] text-[var(--ink-muted)] uppercase">
            Operations
          </p>
          <DashboardNavigation />
        </div>

        <div className="border-t border-[var(--hairline)] p-4">
          <div className="mb-4 min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--ink)]">{user.name}</p>
            <p className="mt-1 truncate text-[10px] text-[var(--ink-muted)]">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <div className="hidden h-[82px] items-center justify-between border-b border-[var(--hairline)] px-8 lg:flex xl:px-10">
          <div>
            <p className="text-xs font-semibold text-[var(--ink)]">အတွင်းပိုင်း လုပ်ငန်းစနစ်</p>
            <p className="mt-1 text-[10px] text-[var(--ink-muted)]">Internal operations system</p>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/new">စာရင်းအသစ် / New entry</Link>
          </Button>
        </div>
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
