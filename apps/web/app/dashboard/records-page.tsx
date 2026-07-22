import Link from "next/link";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { formatYangonDateTime, getYangonDateTime } from "@/lib/exchange-rate";

import { NewEntryDialog } from "./new-entry-dialog";

type RecordType = "cash-bank" | "exchange" | "expense";

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

function formatMoney(value: string, currency: "MMK" | "THB") {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

interface RecordsPageProps {
  type: RecordType;
}

export async function RecordsPage({ type }: Readonly<RecordsPageProps>) {
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const current = getYangonDateTime();
  const date = current.date || todayInYangon();
  const records = await caller.operations.list({ date, type });
  const pageTitle =
    type === "exchange" ? "Exchange" : type === "cash-bank" ? "Cash ↔ Bank" : "Expenses";

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-[var(--hairline)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="sr-only">{pageTitle}</h1>
          <p className="text-sm font-semibold text-[var(--ink-secondary)]">{date} · Today</p>
        </div>
        <NewEntryDialog defaultDate={date} defaultTime={current.time} type={type} />
      </header>

      <section className="border border-[var(--hairline)] bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase sm:px-6">
          <span>Details</span>
          <span>Amount</span>
        </div>
        {records.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">No records for today</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">No records for today.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--hairline)]">
            {records.map((record) => (
              <article
                className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                key={record.id}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {record.description ||
                      (record.type === "expense" ? "No particular" : "No description")}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--ink-muted)] uppercase">
                    {record.type === "exchange"
                      ? record.direction === "thb-to-mmk"
                        ? "THB to MMK"
                        : "MMK to THB"
                      : record.type === "cash-bank"
                        ? record.direction === "bank-to-cash"
                          ? "Bank In → Cash Out"
                          : "Cash In → Bank Out"
                        : `${record.currency} expense`}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
                    {formatYangonDateTime(record.transactionAt)}
                  </p>
                  <Link
                    className="mt-2 inline-block text-[11px] font-semibold text-[var(--primary-dark)] underline underline-offset-4"
                    href={
                      record.type === "exchange"
                        ? `/dashboard/exchange/${record.id}/edit`
                        : record.type === "cash-bank"
                          ? `/dashboard/cash-bank/${record.id}/edit`
                          : `/dashboard/expenses/${record.id}/edit`
                    }
                  >
                    Edit Record
                  </Link>
                </div>
                <div className="text-left sm:text-right">
                  {record.type === "exchange" ? (
                    <>
                      <p className="font-semibold tabular-nums text-[var(--ink)]">
                        {formatMoney(
                          record.sourceAmount,
                          record.direction === "thb-to-mmk" ? "THB" : "MMK",
                        )}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                        Profit {formatMoney(record.formulaProfitThb, "THB")} THB
                      </p>
                    </>
                  ) : record.type === "cash-bank" ? (
                    <>
                      <p className="font-semibold tabular-nums text-[var(--ink)]">
                        {formatMoney(record.principalAmount, record.currency)} {record.currency}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                        Fee {formatMoney(record.feeAmount, record.currency)}
                      </p>
                    </>
                  ) : (
                    <p className="font-semibold tabular-nums text-[var(--ink)]">
                      {formatMoney(record.amount, record.currency)} {record.currency}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">
        Showing up to 100 records for today.
      </p>
    </div>
  );
}
