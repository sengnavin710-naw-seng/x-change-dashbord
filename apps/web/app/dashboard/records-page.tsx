import Link from "next/link";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@repo/api";

import { formatYangonDateTime, getYangonDateTime } from "@/lib/exchange-rate";

import { NewEntryDialog } from "./new-entry-dialog";
import { SingleDateFilter } from "./single-date-filter";

type RecordType = "cash-bank" | "exchange" | "expense";
type AppRouterCaller = ReturnType<typeof appRouter.createCaller>;
type OperationRecord = Awaited<ReturnType<AppRouterCaller["operations"]["list"]>>[number];
type CashBankRecord = Extract<OperationRecord, { type: "cash-bank" }>;
type ExchangeRecord = Extract<OperationRecord, { type: "exchange" }>;
type ExpenseRecord = Extract<OperationRecord, { type: "expense" }>;

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

function formatMovementAmount(value: string, currency: "MMK" | "THB", includeCurrency = false) {
  if (Number(value) === 0) return "—";
  return `${formatMoney(value, currency)}${includeCurrency ? ` ${currency}` : ""}`;
}

interface RecordsPageProps {
  searchParams: Promise<{ date?: string | string[] }>;
  type: RecordType;
}

export async function RecordsPage({ searchParams, type }: Readonly<RecordsPageProps>) {
  const caller = appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
  const current = getYangonDateTime();
  const today = current.date || todayInYangon();
  const date = selectedDate((await searchParams).date, today);
  const records = await caller.operations.list({ date, type });
  const pageTitle =
    type === "exchange" ? "Exchange" : type === "cash-bank" ? "Cash ↔ Bank" : "Expenses";

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
        {records.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6">
            <p className="font-semibold text-[var(--ink)]">No records for selected date</p>
          </div>
        ) : type === "exchange" ? (
          <ExchangeHistory
            records={records.filter(
              (record): record is ExchangeRecord => record.type === "exchange",
            )}
          />
        ) : type === "cash-bank" ? (
          <CashBankHistory
            records={records.filter(
              (record): record is CashBankRecord => record.type === "cash-bank",
            )}
          />
        ) : (
          <ExpenseHistory
            records={records.filter((record): record is ExpenseRecord => record.type === "expense")}
          />
        )}
      </section>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">
        Showing up to 100 records for selected date.
      </p>
    </div>
  );
}

function editHref(type: RecordType, id: string) {
  if (type === "exchange") return `/dashboard/exchange/${id}/edit`;
  if (type === "cash-bank") return `/dashboard/cash-bank/${id}/edit`;
  return `/dashboard/expenses/${id}/edit`;
}

function EditRecordLink({ href }: Readonly<{ href: string }>) {
  return (
    <Link
      className="text-xs font-semibold text-[var(--primary-dark)] underline underline-offset-4"
      href={href}
    >
      Edit
    </Link>
  );
}

function MobileMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="bg-white p-3">
      <p className="text-[9px] font-semibold tracking-[0.06em] text-[var(--ink-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">{value}</p>
    </div>
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

function ExchangeHistory({ records }: Readonly<{ records: ExchangeRecord[] }>) {
  return (
    <>
      <div className="hidden xl:block">
        <div className="grid grid-cols-[95px_80px_minmax(65px,1.2fr)_minmax(85px,1fr)_minmax(90px,1fr)_minmax(85px,1fr)_minmax(90px,1fr)_minmax(95px,1fr)_minmax(85px,0.9fr)_55px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-3 py-3 text-[10px] font-semibold tracking-[0.04em] text-[var(--ink-muted)] uppercase">
          <span>Date / Time</span>
          <span>Direction</span>
          <span>Description</span>
          <span className="text-right">IN THB</span>
          <span className="text-right">IN MMK</span>
          <span className="text-right">OUT THB</span>
          <span className="text-right">ER MMK</span>
          <span className="text-right">Actual MMK</span>
          <span className="text-right">Profit (THB)</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {records.map((record) => {
            const isThbToMmk = record.direction === "thb-to-mmk";
            return (
              <article
                className="grid grid-cols-[95px_80px_minmax(65px,1.2fr)_minmax(85px,1fr)_minmax(90px,1fr)_minmax(85px,1fr)_minmax(90px,1fr)_minmax(95px,1fr)_minmax(85px,0.9fr)_55px] items-center px-3 py-4 text-[13px]"
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
                <div className="text-right">
                  <EditRecordLink href={editHref("exchange", record.id)} />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-[var(--hairline)] xl:hidden">
        {records.map((record) => {
          const isThbToMmk = record.direction === "thb-to-mmk";
          return (
            <article className="p-5 sm:p-6" key={record.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--ink)]">{record.description || "-"}</p>
                  <div className="mt-1">
                    <CompactDateTime value={record.transactionAt} />
                  </div>
                </div>
                <EditRecordLink href={editHref("exchange", record.id)} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3">
                <MobileMetric label="Direction" value={isThbToMmk ? "THB → MMK" : "MMK → THB"} />
                <MobileMetric
                  label="IN THB"
                  value={isThbToMmk ? `${formatMoney(record.sourceAmount, "THB")} THB` : "—"}
                />
                <MobileMetric
                  label="IN MMK"
                  value={isThbToMmk ? "—" : `${formatMoney(record.sourceAmount, "MMK")} MMK`}
                />
                <MobileMetric
                  label="OUT THB"
                  value={isThbToMmk ? "—" : `${formatMoney(record.actualPayout, "THB")} THB`}
                />
                <MobileMetric
                  label="ER MMK"
                  value={isThbToMmk ? `${formatMoney(record.calculatedPayout, "MMK")} MMK` : "—"}
                />
                <MobileMetric
                  label="Actual MMK"
                  value={isThbToMmk ? `${formatMoney(record.actualPayout, "MMK")} MMK` : "—"}
                />
                <MobileMetric
                  label="Profit (THB)"
                  value={`${formatMoney(record.formulaProfitThb, "THB")} THB`}
                />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CashBankHistory({ records }: Readonly<{ records: CashBankRecord[] }>) {
  return (
    <>
      <div className="hidden xl:block">
        <div className="grid grid-cols-[100px_85px_50px_minmax(105px,1.15fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(85px,0.9fr)_60px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-3 py-3 text-[10px] font-semibold tracking-[0.04em] text-[var(--ink-muted)] uppercase">
          <span>Date / Time</span>
          <span>Direction</span>
          <span>Currency</span>
          <span className="text-right">Principal</span>
          <span className="text-right">Bank In</span>
          <span className="text-right">Cash Out</span>
          <span className="text-right">Cash In</span>
          <span className="text-right">Bank Out</span>
          <span className="text-right">Profit</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-[var(--hairline)]">
          {records.map((record) => (
            <article
              className="grid grid-cols-[100px_85px_50px_minmax(105px,1.15fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(85px,0.9fr)_60px] items-center px-3 py-4 text-[13px]"
              key={record.id}
            >
              <CompactDateTime value={record.transactionAt} />
              <p className="pr-2 text-xs font-semibold text-[var(--ink)]">
                {record.direction === "bank-to-cash" ? "Bank → Cash" : "Cash → Bank"}
              </p>
              <p className="text-xs font-semibold text-[var(--ink-muted)]">{record.currency}</p>
              <AmountCell value={formatMoney(record.principalAmount, record.currency)} />
              <AmountCell value={formatMovementAmount(record.bankIn, record.currency)} />
              <AmountCell value={formatMovementAmount(record.cashOut, record.currency)} />
              <AmountCell value={formatMovementAmount(record.cashIn, record.currency)} />
              <AmountCell value={formatMovementAmount(record.bankOut, record.currency)} />
              <AmountCell value={formatMoney(record.feeAmount, record.currency)} />
              <div className="text-right">
                <EditRecordLink href={editHref("cash-bank", record.id)} />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[var(--hairline)] xl:hidden">
        {records.map((record) => (
          <article className="p-5 sm:p-6" key={record.id}>
            <div className="flex items-start justify-between gap-4">
              <CompactDateTime value={record.transactionAt} />
              <EditRecordLink href={editHref("cash-bank", record.id)} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3">
              <MobileMetric
                label="Direction"
                value={record.direction === "bank-to-cash" ? "Bank → Cash" : "Cash → Bank"}
              />
              <MobileMetric label="Currency" value={record.currency} />
              <MobileMetric
                label="Principal"
                value={`${formatMoney(record.principalAmount, record.currency)} ${record.currency}`}
              />
              <MobileMetric
                label="Bank In"
                value={formatMovementAmount(record.bankIn, record.currency, true)}
              />
              <MobileMetric
                label="Cash Out"
                value={formatMovementAmount(record.cashOut, record.currency, true)}
              />
              <MobileMetric
                label="Cash In"
                value={formatMovementAmount(record.cashIn, record.currency, true)}
              />
              <MobileMetric
                label="Bank Out"
                value={formatMovementAmount(record.bankOut, record.currency, true)}
              />
              <MobileMetric
                label="Profit"
                value={`${formatMoney(record.feeAmount, record.currency)} ${record.currency}`}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ExpenseHistory({ records }: Readonly<{ records: ExpenseRecord[] }>) {
  return (
    <>
      <div className="hidden overflow-x-auto xl:block">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[155px_minmax(260px,1fr)_160px_70px] border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-3 text-[10px] font-semibold tracking-[0.06em] text-[var(--ink-muted)] uppercase">
            <span>Date / Time</span>
            <span>Particular</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-[var(--hairline)]">
            {records.map((record) => (
              <article
                className="grid grid-cols-[155px_minmax(260px,1fr)_160px_70px] items-center px-5 py-4 text-sm"
                key={record.id}
              >
                <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatYangonDateTime(record.transactionAt)}
                </p>
                <p className="pr-5 font-semibold text-[var(--ink)]">{record.description}</p>
                <MoneyCell
                  currency={record.currency}
                  value={formatMoney(record.amount, record.currency)}
                />
                <div className="text-right">
                  <EditRecordLink href={editHref("expense", record.id)} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--hairline)] xl:hidden">
        {records.map((record) => (
          <article className="p-5 sm:p-6" key={record.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-[var(--ink)]">{record.description}</p>
                <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
                  {formatYangonDateTime(record.transactionAt)}
                </p>
              </div>
              <EditRecordLink href={editHref("expense", record.id)} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-px border border-[var(--hairline)] bg-[var(--hairline)]">
              <MobileMetric
                label="Amount"
                value={`${formatMoney(record.amount, record.currency)} ${record.currency}`}
              />
            </div>
          </article>
        ))}
      </div>
    </>
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
  return <p className="text-right font-semibold tabular-nums text-[var(--ink)]">{value}</p>;
}
