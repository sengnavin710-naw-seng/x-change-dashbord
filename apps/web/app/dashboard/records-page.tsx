import Link from "next/link";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { getYangonDateTime } from "@/lib/exchange-rate";
import type { MessageKey } from "@/lib/i18n";
import { getServerTranslator } from "@/lib/i18n-server";

import { NewEntryDialog } from "./new-entry-dialog";
import { SingleDateFilter } from "./single-date-filter";
import { RecentTransactionHighlighter } from "./transaction-motion";

type RecordType = "cash-bank" | "exchange" | "expense";
type AppRouterCaller = ReturnType<typeof appRouter.createCaller>;
type OperationRecord = Awaited<ReturnType<AppRouterCaller["operations"]["list"]>>[number];
type CashBankRecord = Extract<OperationRecord, { type: "cash-bank" }>;
type ExchangeRecord = Extract<OperationRecord, { type: "exchange" }>;
type ExpenseRecord = Extract<OperationRecord, { type: "expense" }>;
type Translator = (key: MessageKey) => string;

const exchangeHistoryGrid =
  "grid-cols-[125px_105px_140px_110px_115px_110px_115px_125px_115px_80px]";
const cashBankHistoryGrid =
  "grid-cols-[110px_100px_70px_100px_105px_105px_105px_105px_90px_65px] lg:grid-cols-[1.05fr_.95fr_.65fr_.9fr_repeat(4,minmax(0,1fr))_.8fr_.55fr]";
const expenseHistoryGrid = "grid-cols-[170px_minmax(350px,1fr)_160px_96px]";

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

function selectedDate(value: string | string[] | undefined, today: string) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate) || candidate > today) {
    return today;
  }

  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate
    ? today
    : candidate;
}

function formatMoney(value: string, currency: "MMK" | "THB") {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "THB" ? 2 : 0,
    minimumFractionDigits: currency === "THB" ? 2 : 0,
  }).format(Number(value));
}

function formatMovementAmount(value: string, currency: "MMK" | "THB") {
  if (Number(value) === 0) return "—";
  return formatMoney(value, currency);
}

interface RecordsPageProps {
  searchParams: Promise<{ date?: string | string[] }>;
  type: RecordType;
}

export async function RecordsPage({ searchParams, type }: Readonly<RecordsPageProps>) {
  const { t } = await getServerTranslator();
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const current = getYangonDateTime();
  const today = current.date || todayInYangon();
  const date = selectedDate((await searchParams).date, today);
  const records = await caller.operations.list({ date, type });
  const pageTitle =
    type === "exchange" ? t("exchange") : type === "cash-bank" ? t("cashBank") : t("expenses");

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-3 border-b border-[var(--hairline)] pb-7 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="sr-only">{pageTitle}</h1>
        <SingleDateFilter
          ariaLabel={`${pageTitle} date filter`}
          date={date}
          filterId={`${type}-date-filter`}
          maximumDate={today}
        />
        <NewEntryDialog defaultDate={date} defaultTime={current.time} type={type} />
      </header>

      <section className="border border-[var(--hairline)] bg-white">
        <RecentTransactionHighlighter
          refreshKey={records.map((record) => `${record.type}:${record.id}`).join("|")}
        />
        {records.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">{t("noRecordsDate")}</p>
          </div>
        ) : type === "exchange" ? (
          <ExchangeHistory
            records={records.filter(
              (record): record is ExchangeRecord => record.type === "exchange",
            )}
            t={t}
          />
        ) : type === "cash-bank" ? (
          <CashBankHistory
            records={records.filter(
              (record): record is CashBankRecord => record.type === "cash-bank",
            )}
            t={t}
          />
        ) : (
          <ExpenseHistory
            records={records.filter((record): record is ExpenseRecord => record.type === "expense")}
            t={t}
          />
        )}
      </section>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">{t("showingRecords")}</p>
    </div>
  );
}

function editHref(type: RecordType, id: string) {
  if (type === "exchange") return `/dashboard/exchange/${id}/edit`;
  if (type === "cash-bank") return `/dashboard/cash-bank/${id}/edit`;
  return `/dashboard/expenses/${id}/edit`;
}

function EditRecordLink({ href, t }: Readonly<{ href: string; t: Translator }>) {
  return (
    <Link
      className="text-xs font-semibold text-[var(--primary-dark)] underline underline-offset-4"
      href={href}
    >
      {t("edit")}
    </Link>
  );
}

function CompactDateTime({ value }: Readonly<{ value: string }>) {
  const dateTime = getYangonDateTime(new Date(value));

  return (
    <p className="text-xs leading-5 tabular-nums text-[var(--ink-muted)]">
      <span className="block">{dateTime.date}</span>
      <span className="block">{dateTime.time}</span>
    </p>
  );
}

function ExchangeHistory({ records, t }: Readonly<{ records: ExchangeRecord[]; t: Translator }>) {
  return (
    <div
      aria-label={`${t("exchange")} ${t("transactions")}`}
      className="w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
      tabIndex={0}
    >
      <div className="min-w-[1172px]">
        <div
          className={`grid ${exchangeHistoryGrid} border-b border-[var(--hairline)] bg-[#f4f7fb] px-4 py-3 text-[10px] font-semibold tracking-[0.04em] whitespace-nowrap text-[var(--ink-muted)] uppercase`}
        >
          <span>{t("dateTime")}</span>
          <span>{t("direction")}</span>
          <span>{t("description")}</span>
          <span className="pr-2 text-right">IN THB</span>
          <span className="pr-2 text-right">IN MMK</span>
          <span className="pr-2 text-right">OUT THB</span>
          <span className="pr-2 text-right">ER MMK</span>
          <span className="pr-2 text-right">Actual MMK</span>
          <span className="pr-2 text-right">{t("profitThb")}</span>
          <span className="pr-2 text-right">{t("action")}</span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {records.map((record) => {
            const isThbToMmk = record.direction === "thb-to-mmk";
            return (
              <article
                className={`grid ${exchangeHistoryGrid} items-center px-4 py-4 text-[13px]`}
                data-transaction-key={`exchange:${record.id}`}
                key={record.id}
              >
                <CompactDateTime value={record.transactionAt} />
                <p className="pr-2 text-xs font-semibold text-[var(--ink)]">
                  {isThbToMmk ? "THB → MMK" : "MMK → THB"}
                </p>
                <p className="min-w-0 pr-3 text-[var(--ink-secondary)]">
                  {record.description || "-"}
                </p>
                <AmountCell value={isThbToMmk ? formatMoney(record.sourceAmount, "THB") : "—"} />
                <AmountCell value={isThbToMmk ? "—" : formatMoney(record.sourceAmount, "MMK")} />
                <AmountCell value={isThbToMmk ? "—" : formatMoney(record.actualPayout, "THB")} />
                <AmountCell
                  value={isThbToMmk ? formatMoney(record.calculatedPayout, "MMK") : "—"}
                />
                <AmountCell value={isThbToMmk ? formatMoney(record.actualPayout, "MMK") : "—"} />
                <AmountCell value={formatMoney(record.formulaProfitThb, "THB")} />
                <div className="pr-2 text-right">
                  <EditRecordLink href={editHref("exchange", record.id)} t={t} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CashBankHistory({ records, t }: Readonly<{ records: CashBankRecord[]; t: Translator }>) {
  return (
    <div
      aria-label={`${t("cashBank")} ${t("transactions")}`}
      className="w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
      tabIndex={0}
    >
      <div className="min-w-[987px] lg:min-w-0">
        <div
          className={`grid ${cashBankHistoryGrid} border-b border-[var(--hairline)] bg-[#f4f7fb] px-4 py-3 text-[10px] font-semibold tracking-[0.04em] whitespace-nowrap text-[var(--ink-muted)] uppercase`}
        >
          <span>{t("dateTime")}</span>
          <span>{t("direction")}</span>
          <span>{t("currency")}</span>
          <span>{t("description")}</span>
          <span className="pr-2 text-right">{t("bankIn")}</span>
          <span className="pr-2 text-right">{t("cashOut")}</span>
          <span className="pr-2 text-right">{t("cashIn")}</span>
          <span className="pr-2 text-right">{t("bankOut")}</span>
          <span className="pr-2 text-right">{t("profit")}</span>
          <span className="pr-2 text-right">{t("action")}</span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {records.map((record) => (
            <article
              className={`grid ${cashBankHistoryGrid} items-center px-4 py-4 text-[13px]`}
              data-transaction-key={`cash-bank:${record.id}`}
              key={record.id}
            >
              <CompactDateTime value={record.transactionAt} />
              <p className="pr-2 text-xs font-semibold text-[var(--ink)]">
                {record.direction === "bank-to-cash" ? "Bank → Cash" : "Cash → Bank"}
              </p>
              <p className="text-xs font-semibold text-[var(--ink-muted)]">{record.currency}</p>
              <p className="min-w-0 pr-4 text-[var(--ink-secondary)]">
                {record.description || "-"}
              </p>
              <AmountCell value={formatMovementAmount(record.bankIn, record.currency)} />
              <AmountCell value={formatMovementAmount(record.cashOut, record.currency)} />
              <AmountCell value={formatMovementAmount(record.cashIn, record.currency)} />
              <AmountCell value={formatMovementAmount(record.bankOut, record.currency)} />
              <AmountCell value={formatMoney(record.feeAmount, record.currency)} />
              <div className="pr-2 text-right">
                <EditRecordLink href={editHref("cash-bank", record.id)} t={t} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseHistory({ records, t }: Readonly<{ records: ExpenseRecord[]; t: Translator }>) {
  return (
    <div
      aria-label={`${t("expenses")} ${t("transactions")}`}
      className="w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
      tabIndex={0}
    >
      <div className="w-full min-w-[776px]">
        <div
          className={`grid ${expenseHistoryGrid} border-b border-[var(--hairline)] bg-[#f4f7fb] text-[10px] font-semibold tracking-[0.06em] text-[var(--ink-muted)] uppercase`}
        >
          <span className="px-5 py-3">{t("dateTime")}</span>
          <span className="border-l border-[var(--hairline)] px-4 py-3">{t("particular")}</span>
          <span className="border-l border-[var(--hairline)] px-4 py-3 text-right">
            {t("amount")}
          </span>
          <span className="border-l border-[var(--hairline)] px-4 py-3 text-right">
            {t("action")}
          </span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {records.map((record) => (
            <article
              className={`grid ${expenseHistoryGrid} text-sm`}
              data-transaction-key={`expense:${record.id}`}
              key={record.id}
            >
              <div className="flex items-center px-5 py-4">
                <CompactDateTime value={record.transactionAt} />
              </div>
              <p className="flex items-center border-l border-[var(--hairline)] px-4 py-4 font-semibold text-[var(--ink)]">
                {record.description || "-"}
              </p>
              <div className="flex items-center justify-end border-l border-[var(--hairline)] px-4 py-4">
                <MoneyCell
                  currency={record.currency}
                  value={formatMoney(record.amount, record.currency)}
                />
              </div>
              <div className="flex items-center justify-end border-l border-[var(--hairline)] px-4 py-4">
                <EditRecordLink href={editHref("expense", record.id)} t={t} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoneyCell({ currency, value }: Readonly<{ currency: "MMK" | "THB"; value: string }>) {
  return (
    <p className="text-right font-semibold tabular-nums text-[var(--ink)]">
      {value} <span className="text-[10px] text-[var(--ink-muted)]">{currency}</span>
    </p>
  );
}

function AmountCell({ value }: Readonly<{ value: string }>) {
  return <p className="pr-2 text-right font-semibold tabular-nums text-[var(--ink)]">{value}</p>;
}
