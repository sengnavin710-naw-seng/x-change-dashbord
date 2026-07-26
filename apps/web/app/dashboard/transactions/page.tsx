import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { TransactionFilters, type TransactionRange } from "./transaction-filters";
import { getServerTranslator } from "../../../lib/i18n-server";
import type { MessageKey } from "../../../lib/i18n";
import { RecentTransactionHighlighter } from "../transaction-motion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All Transactions" };

type TransactionType = "cash-bank" | "exchange" | "expense";
type Currency = "MMK" | "THB";
type Order = "newest" | "oldest";
type SearchParams = Record<string, string | string[] | undefined>;

const transactionHistoryGrid = "grid-cols-[150px_130px_160px_190px_190px_140px_90px]";

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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

function offsetCalendarDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function firstDayOfWeek(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const daysSinceMonday = (value.getUTCDay() + 6) % 7;
  return offsetCalendarDate(date, -daysSinceMonday);
}

function previousMonth(date: string) {
  const lastDay = offsetCalendarDate(`${date.slice(0, 7)}-01`, -1);
  return {
    from: `${lastDay.slice(0, 7)}-01`,
    to: lastDay,
  };
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

function labelForType(type: TransactionType, t: (key: MessageKey) => string) {
  if (type === "exchange") return t("exchange");
  if (type === "cash-bank") return t("cashBank");
  return t("expenses");
}

function labelForDirection(
  type: TransactionType,
  direction: string | null,
  t: (key: MessageKey) => string,
) {
  if (type === "exchange") return direction === "thb-to-mmk" ? "THB → MMK" : "MMK → THB";
  if (type === "cash-bank") {
    return direction === "bank-to-cash" ? t("bankInCashOut") : t("cashInBankOut");
  }
  return "—";
}

function formatMovement(
  amount: string | null,
  currency: Currency | null,
  channel: "Bank" | "Cash" | null,
) {
  if (!amount || !currency) return "—";
  const prefix = channel ? `${channel} · ` : "";
  return `${prefix}${formatMoney(amount, currency)} ${currency}`;
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
  const { t } = await getServerTranslator();
  const today = todayInYangon();
  const requestedRange = scalar(values.range);
  const parsedRange: TransactionRange =
    requestedRange === "yesterday" ||
    requestedRange === "week" ||
    requestedRange === "month" ||
    requestedRange === "last-month" ||
    requestedRange === "custom"
      ? requestedRange
      : "today";
  const customFrom = scalar(values.from);
  const customTo = scalar(values.to);
  const validCustomFrom = isDate(customFrom) ? customFrom : null;
  const validCustomTo = isDate(customTo) ? customTo : null;
  const validCustomRange = Boolean(
    validCustomFrom && validCustomTo && validCustomFrom <= validCustomTo && validCustomTo <= today,
  );
  const range: TransactionRange =
    parsedRange === "custom" && !validCustomRange ? "today" : parsedRange;
  const lastMonth = previousMonth(today);
  const fromDate =
    range === "yesterday"
      ? offsetCalendarDate(today, -1)
      : range === "week"
        ? firstDayOfWeek(today)
        : range === "month"
          ? `${today.slice(0, 7)}-01`
          : range === "last-month"
            ? lastMonth.from
            : range === "custom" && validCustomRange && validCustomFrom
              ? validCustomFrom
              : today;
  const toDate =
    range === "yesterday"
      ? offsetCalendarDate(today, -1)
      : range === "last-month"
        ? lastMonth.to
        : range === "custom" && validCustomRange && validCustomTo
          ? validCustomTo
          : today;
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
  if (range !== "today") query.set("range", range);
  if (range === "custom") {
    query.set("from", fromDate);
    query.set("to", toDate);
  }
  if (type) query.set("type", type);
  if (currency) query.set("currency", currency);
  if (order === "oldest") query.set("order", order);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 border-b border-[var(--hairline)] pb-6">
        <h1 className="font-[var(--font-display)] text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {t("allTransactions")}
        </h1>
        <p className="pb-1 text-xs font-semibold text-[var(--ink-muted)]">
          {result.total} {t(result.total === 1 ? "transaction" : "transactions")}
        </p>
      </header>

      <TransactionFilters
        {...(currency ? { currency } : {})}
        fromDate={fromDate}
        order={order}
        range={range}
        toDate={toDate}
        today={today}
        {...(type ? { type } : {})}
      />

      <section className="border border-[var(--hairline)] bg-white" aria-label={t("transactions")}>
        <RecentTransactionHighlighter
          refreshKey={result.items.map((item) => `${item.type}:${item.id}`).join("|")}
        />
        {result.items.length === 0 ? (
          <div className="px-5 py-16 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">{t("noTransactions")}</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">{t("tryAnotherFilter")}</p>
          </div>
        ) : (
          <div
            aria-label={t("allTransactions")}
            className="w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
            tabIndex={0}
          >
            <div className="min-w-[1090px]">
              <div
                className={`grid ${transactionHistoryGrid} items-center border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold tracking-[0.06em] whitespace-nowrap text-[var(--ink-muted)] uppercase`}
              >
                <span>{t("dateTime")}</span>
                <span>{t("type")}</span>
                <span>{t("direction")}</span>
                <span className="pr-2 text-right">{t("in")}</span>
                <span className="pr-2 text-right">{t("out")}</span>
                <span className="pr-2 text-right">{t("profit")}</span>
                <span className="pr-2 text-right">{t("action")}</span>
              </div>
              <div className="divide-y divide-[var(--hairline)]">
                {result.items.map((item) => {
                  const dateTime = formatDateTime(item.transactionAt);
                  return (
                    <article
                      className={`grid ${transactionHistoryGrid} items-center px-5 py-4 text-sm`}
                      data-transaction-key={`${item.type}:${item.id}`}
                      key={`${item.type}-${item.id}`}
                    >
                      <div className="tabular-nums">
                        <p className="font-semibold text-[var(--ink)]">{dateTime.date}</p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">{dateTime.time}</p>
                      </div>
                      <p className="font-semibold text-[var(--ink)]">
                        {labelForType(item.type, t)}
                      </p>
                      <p className="pr-4 font-medium text-[var(--ink-secondary)]">
                        {labelForDirection(item.type, item.direction, t)}
                      </p>
                      <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink)]">
                        {formatMovement(item.inAmount, item.inCurrency, item.inChannel)}
                      </p>
                      <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink)]">
                        {formatMovement(item.outAmount, item.outCurrency, item.outChannel)}
                      </p>
                      <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink-secondary)]">
                        {item.profitAmount && item.profitCurrency
                          ? `${formatMoney(item.profitAmount, item.profitCurrency)} ${item.profitCurrency}`
                          : "—"}
                      </p>
                      <Link
                        className="justify-self-end pr-2 text-xs font-semibold text-[var(--primary-dark)] underline underline-offset-4"
                        href={editHref(item.type, item.id)}
                      >
                        {t("edit")}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-5 text-xs text-[var(--ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t("page")} {result.page} {t("of")} {result.totalPages} · {result.total} {t("records")}
        </p>
        <div className="flex gap-2">
          {result.page > 1 ? (
            <Link
              className="rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 py-2 font-semibold text-[var(--ink-secondary)]"
              href={pageHref(query, result.page - 1)}
            >
              {t("previous")}
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link
              className="rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 py-2 font-semibold text-[var(--ink-secondary)]"
              href={pageHref(query, result.page + 1)}
            >
              {t("next")}
            </Link>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
