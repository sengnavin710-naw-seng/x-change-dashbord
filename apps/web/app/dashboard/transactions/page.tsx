import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All Transactions" };

type TransactionType = "cash-bank" | "exchange" | "expense";
type Currency = "MMK" | "THB";
type Order = "newest" | "oldest";
type Range = "custom" | "month" | "today";
type SearchParams = Record<string, string | string[] | undefined>;

const controlClass =
  "h-11 w-full rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]";

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function todayInYangon() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Yangon",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatMoney(value: string, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "Asia/Yangon",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      timeZone: "Asia/Yangon",
    }).format(date),
  };
}

function labelForType(type: TransactionType) {
  if (type === "exchange") return "Exchange";
  if (type === "cash-bank") return "Cash ↔ Bank";
  return "Expenses";
}

function detailForDirection(type: TransactionType, direction: string | null) {
  if (type === "exchange") return direction === "thb-to-mmk" ? "THB to MMK" : "MMK to THB";
  if (type === "cash-bank")
    return direction === "bank-to-cash" ? "Bank In → Cash Out" : "Cash In → Bank Out";
  return "Expense";
}

function editHref(type: TransactionType, id: string) {
  if (type === "exchange") return `/dashboard/exchange/${id}/edit`;
  if (type === "cash-bank") return `/dashboard/cash-bank/${id}/edit`;
  return `/dashboard/expenses/${id}/edit`;
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/dashboard/transactions?${next.toString()}`;
}

export default async function AllTransactionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const values = await searchParams;
  const today = todayInYangon();
  const requestedRange = scalar(values.range);
  const range: Range =
    requestedRange === "month" || requestedRange === "custom" ? requestedRange : "today";
  const customFrom = scalar(values.from);
  const customTo = scalar(values.to);
  const validCustomFrom = isDate(customFrom) ? customFrom : null;
  const validCustomTo = isDate(customTo) ? customTo : null;
  const validCustomRange = Boolean(
    validCustomFrom && validCustomTo && validCustomFrom <= validCustomTo,
  );
  const fromDate =
    range === "month"
      ? `${today.slice(0, 7)}-01`
      : range === "custom" && validCustomRange && validCustomFrom
        ? validCustomFrom
        : today;
  const toDate = range === "custom" && validCustomRange && validCustomTo ? validCustomTo : today;
  const requestedType = scalar(values.type);
  const type: TransactionType | undefined =
    requestedType === "exchange" || requestedType === "cash-bank" || requestedType === "expense"
      ? requestedType
      : undefined;
  const requestedCurrency = scalar(values.currency);
  const currency: Currency | undefined =
    requestedCurrency === "THB" || requestedCurrency === "MMK" ? requestedCurrency : undefined;
  const order: Order = scalar(values.order) === "oldest" ? "oldest" : "newest";
  const parsedPage = Number(scalar(values.page) ?? "1");
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const result = await caller.operations.allTransactions({
    ...(currency ? { currency } : {}),
    fromDate,
    order,
    page,
    pageSize: 25,
    toDate,
    ...(type ? { type } : {}),
  });
  const query = new URLSearchParams();
  query.set("range", range);
  query.set("from", fromDate);
  query.set("to", toDate);
  if (type) query.set("type", type);
  if (currency) query.set("currency", currency);
  query.set("order", order);
  const filterActive = range === "custom" || Boolean(type || currency) || order === "oldest";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--hairline)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
            All Transactions
          </h1>
          <p className="mt-2 text-sm tabular-nums text-[var(--ink-muted)]">
            {fromDate === toDate ? fromDate : `${fromDate} — ${toDate}`} · {result.total} entries
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Date range shortcuts">
          <Link
            className={`rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors ${
              range === "today"
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] hover:border-[var(--ink-muted)]"
            }`}
            href="/dashboard/transactions?range=today"
          >
            Today
          </Link>
          <Link
            className={`rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors ${
              range === "month"
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] hover:border-[var(--ink-muted)]"
            }`}
            href="/dashboard/transactions?range=month"
          >
            This Month
          </Link>
        </div>
      </header>

      <details className="border border-[var(--hairline)] bg-white" open={filterActive}>
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset sm:px-6">
          Filters
        </summary>
        <form className="max-w-[560px] space-y-5 border-t border-[var(--hairline)] p-5 sm:p-6">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Date Range</span>
            <select className={controlClass} defaultValue={range} name="range">
              <option value="today">Today</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Start Date</span>
            <input
              className={controlClass}
              defaultValue={fromDate}
              name="from"
              required
              type="date"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">End Date</span>
            <input className={controlClass} defaultValue={toDate} name="to" required type="date" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Transaction Type</span>
            <select className={controlClass} defaultValue={type ?? ""} name="type">
              <option value="">All Types</option>
              <option value="exchange">Exchange</option>
              <option value="cash-bank">Cash ↔ Bank</option>
              <option value="expense">Expenses</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Currency</span>
            <select className={controlClass} defaultValue={currency ?? ""} name="currency">
              <option value="">All Currencies</option>
              <option value="THB">THB</option>
              <option value="MMK">MMK</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Order</span>
            <select className={controlClass} defaultValue={order} name="order">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-[var(--hairline)] pt-5 sm:flex-row sm:justify-end">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-[4px] border border-[var(--hairline-soft)] bg-white px-4 text-sm font-semibold text-[var(--ink-secondary)] hover:border-[var(--ink-muted)]"
              href="/dashboard/transactions"
            >
              Reset
            </Link>
            <button
              className="h-11 rounded-[4px] bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-dark)]"
              type="submit"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </details>

      <section className="border border-[var(--hairline)] bg-white" aria-label="Transactions">
        {result.items.length === 0 ? (
          <div className="px-5 py-16 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">No transactions found</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              Try another date range or filter.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[145px_130px_minmax(190px,1fr)_140px_140px_70px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold tracking-[0.06em] text-[var(--ink-muted)] uppercase xl:grid">
              <span>Date / Time</span>
              <span>Type</span>
              <span>Details</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Profit / Fee</span>
              <span className="text-right">Action</span>
            </div>
            <div className="hidden divide-y divide-[var(--hairline)] xl:block">
              {result.items.map((item) => {
                const dateTime = formatDateTime(item.transactionAt);
                return (
                  <article
                    className="grid grid-cols-[145px_130px_minmax(190px,1fr)_140px_140px_70px] items-center px-5 py-4 text-sm"
                    key={`${item.type}-${item.id}`}
                  >
                    <div className="tabular-nums">
                      <p className="font-semibold text-[var(--ink)]">{dateTime.date}</p>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">{dateTime.time}</p>
                    </div>
                    <p className="font-semibold text-[var(--ink)]">{labelForType(item.type)}</p>
                    <div className="min-w-0 pr-5">
                      <p className="truncate text-[var(--ink-secondary)]">
                        {item.description || "No description"}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                        {detailForDirection(item.type, item.direction)}
                      </p>
                    </div>
                    <p className="text-right font-semibold tabular-nums text-[var(--ink)]">
                      {formatMoney(item.amount, item.currency)} {item.currency}
                    </p>
                    <p className="text-right font-semibold tabular-nums text-[var(--ink-secondary)]">
                      {item.profitAmount && item.profitCurrency
                        ? `${formatMoney(item.profitAmount, item.profitCurrency)} ${item.profitCurrency}`
                        : "—"}
                    </p>
                    <Link
                      className="text-right text-xs font-semibold text-[var(--primary-dark)] underline underline-offset-4"
                      href={editHref(item.type, item.id)}
                    >
                      Edit
                    </Link>
                  </article>
                );
              })}
            </div>
            <div className="divide-y divide-[var(--hairline)] xl:hidden">
              {result.items.map((item) => {
                const dateTime = formatDateTime(item.transactionAt);
                return (
                  <article className="p-5" key={`${item.type}-${item.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{labelForType(item.type)}</p>
                        <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
                          {dateTime.date} · {dateTime.time}
                        </p>
                      </div>
                      <Link
                        className="text-xs font-semibold text-[var(--primary-dark)] underline underline-offset-4"
                        href={editHref(item.type, item.id)}
                      >
                        Edit
                      </Link>
                    </div>
                    <p className="mt-4 text-sm text-[var(--ink-secondary)]">
                      {item.description || "No description"}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                      {detailForDirection(item.type, item.direction)}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
                      <div className="bg-white p-3">
                        <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                          Amount
                        </p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {formatMoney(item.amount, item.currency)} {item.currency}
                        </p>
                      </div>
                      <div className="bg-white p-3">
                        <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase">
                          Profit / Fee
                        </p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {item.profitAmount && item.profitCurrency
                            ? `${formatMoney(item.profitAmount, item.profitCurrency)} ${item.profitCurrency}`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <footer className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-5 text-xs text-[var(--ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Page {result.page} of {result.totalPages} · {result.total} entries
        </p>
        <div className="flex gap-2">
          {result.page > 1 ? (
            <Link
              className="rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 py-2 font-semibold text-[var(--ink-secondary)]"
              href={pageHref(query, result.page - 1)}
            >
              Previous
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link
              className="rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 py-2 font-semibold text-[var(--ink-secondary)]"
              href={pageHref(query, result.page + 1)}
            >
              Next
            </Link>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
