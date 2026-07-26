"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import type { MessageKey } from "../../../lib/i18n";
import { useLanguage } from "../../language-provider";

export type TransactionRange = "custom" | "last-month" | "month" | "today" | "week" | "yesterday";

type TransactionType = "cash-bank" | "exchange" | "expense";
type Currency = "MMK" | "THB";
type Order = "newest" | "oldest";

interface TransactionFiltersProps {
  currency?: Currency;
  fromDate: string;
  order: Order;
  range: TransactionRange;
  toDate: string;
  today: string;
  type?: TransactionType;
}

const presets: ReadonlyArray<{ label: MessageKey; value: Exclude<TransactionRange, "custom"> }> = [
  { label: "today", value: "today" },
  { label: "yesterday", value: "yesterday" },
  { label: "thisWeek", value: "week" },
  { label: "thisMonth", value: "month" },
  { label: "lastMonth", value: "last-month" },
];

const selectClass =
  "h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-xs font-semibold text-[var(--ink-secondary)] outline-none transition-colors hover:border-[var(--ink-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2] disabled:cursor-wait disabled:opacity-60";

const presetBaseClass =
  "inline-flex h-10 items-center justify-center rounded-none border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60";

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 6h16M7 12h10m-7 6h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--ink-muted)]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m7 9 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function presetClass(selected: boolean) {
  return `${presetBaseClass} ${
    selected
      ? "border-[var(--primary)] bg-white text-[var(--primary-dark)]"
      : "border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] hover:border-[var(--ink-muted)]"
  }`;
}

export function TransactionFilters({
  currency,
  fromDate,
  order,
  range,
  toDate,
  today,
  type,
}: Readonly<TransactionFiltersProps>) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateContainerRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCustomOpen, setMobileCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(fromDate);
  const [customTo, setCustomTo] = useState(toDate);
  const [dateError, setDateError] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeFilterCount =
    Number(range !== "today") +
    Number(Boolean(type)) +
    Number(Boolean(currency)) +
    Number(order === "oldest");

  useEffect(() => {
    if (!dateMenuOpen && !mobileOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        dateMenuOpen &&
        !mobileOpen &&
        event.target instanceof Node &&
        dateContainerRef.current &&
        !dateContainerRef.current.contains(event.target)
      ) {
        setDateMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (dateMenuOpen) {
        setDateMenuOpen(false);
        dateTriggerRef.current?.focus();
        return;
      }
      if (mobileCustomOpen) {
        setMobileCustomOpen(false);
        return;
      }
      if (mobileOpen) {
        setMobileOpen(false);
        mobileTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dateMenuOpen, mobileCustomOpen, mobileOpen]);

  function navigate(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function choosePreset(nextRange: Exclude<TransactionRange, "custom">, closeMobile = false) {
    setDateMenuOpen(false);
    setMobileCustomOpen(false);
    setDateError("");
    if (closeMobile) setMobileOpen(false);
    navigate((params) => {
      if (nextRange === "today") {
        params.delete("range");
      } else {
        params.set("range", nextRange);
      }
      params.delete("from");
      params.delete("to");
    });
  }

  function prepareCustomRange() {
    setCustomFrom(fromDate);
    setCustomTo(toDate);
    setDateError("");
  }

  function applyCustomRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customFrom || !customTo) {
      setDateError(t("selectBothDates"));
      return;
    }
    if (customFrom > customTo) {
      setDateError(t("startDateBeforeEnd"));
      return;
    }
    if (customTo > today) {
      setDateError(t("endDateNotFuture"));
      return;
    }

    setDateError("");
    setDateMenuOpen(false);
    setMobileOpen(false);
    setMobileCustomOpen(false);
    navigate((params) => {
      params.set("range", "custom");
      params.set("from", customFrom);
      params.set("to", customTo);
    });
  }

  function changeSelect(key: "currency" | "order" | "type", event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    navigate((params) => {
      const isDefault = !value || (key === "order" && value === "newest");
      if (isDefault) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
  }

  function resetFilters() {
    setDateMenuOpen(false);
    setMobileOpen(false);
    setMobileCustomOpen(false);
    startTransition(() => {
      router.push(pathname);
    });
  }

  const customRangeForm = (
    <form className="space-y-4" onSubmit={applyCustomRange}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[var(--ink-secondary)]">
            {t("startDate")}
          </span>
          <input
            className="h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]"
            max={today}
            onChange={(event) => setCustomFrom(event.target.value)}
            required
            type="date"
            value={customFrom}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[var(--ink-secondary)]">{t("endDate")}</span>
          <input
            className="h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]"
            max={today}
            onChange={(event) => setCustomTo(event.target.value)}
            required
            type="date"
            value={customTo}
          />
        </label>
      </div>
      {dateError ? (
        <p aria-live="polite" className="text-xs font-medium text-red-700">
          {dateError}
        </p>
      ) : null}
      <button
        className="h-10 w-full rounded-none border border-[var(--primary-dark)] bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {t("applyDateRange")}
      </button>
    </form>
  );

  return (
    <>
      <div aria-busy={isPending} aria-label={t("transactionFilters")} className="hidden lg:block">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={dateContainerRef}>
            <button
              aria-controls="transaction-date-filter"
              aria-expanded={dateMenuOpen}
              aria-pressed={range !== "today"}
              className={`${presetClass(range !== "today")} gap-2`}
              disabled={isPending}
              onClick={() => {
                if (dateMenuOpen) {
                  setDateMenuOpen(false);
                } else {
                  prepareCustomRange();
                  setDateMenuOpen(true);
                }
              }}
              ref={dateTriggerRef}
              type="button"
            >
              <CalendarIcon />
              {t("date")}
            </button>
            {dateMenuOpen && !mobileOpen ? (
              <div
                aria-label={`${t("transaction")} ${t("dateFilter")}`}
                className="absolute top-full left-0 z-30 mt-2 w-[640px] max-w-[calc(100vw-22rem)] border border-[var(--hairline)] bg-white shadow-[0_12px_32px_rgba(0,21,60,0.12)]"
                id="transaction-date-filter"
                role="dialog"
              >
                <div className="border-b border-[var(--hairline)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--ink)]">{t("dateFilter")}</p>
                </div>
                <div className="grid grid-cols-[190px_minmax(0,1fr)]">
                  <div className="border-r border-[var(--hairline)] p-3">
                    <div className="grid gap-1.5">
                      {presets.map((preset) => (
                        <button
                          aria-pressed={range === preset.value}
                          className={`${presetClass(range === preset.value)} w-full justify-start`}
                          disabled={isPending}
                          key={preset.value}
                          onClick={() => choosePreset(preset.value)}
                          type="button"
                        >
                          {t(preset.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="mb-4 text-sm font-semibold text-[var(--ink)]">
                      {t("customRange")}
                    </p>
                    {customRangeForm}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative min-w-[180px]">
            <select
              aria-label={t("transactionType")}
              className={`${selectClass} w-full appearance-none pr-10`}
              disabled={isPending}
              onChange={(event) => changeSelect("type", event)}
              value={type ?? ""}
            >
              <option value="">{t("allTypes")}</option>
              <option value="exchange">{t("exchange")}</option>
              <option value="cash-bank">{t("cashBank")}</option>
              <option value="expense">{t("expenses")}</option>
            </select>
            <ChevronDownIcon />
          </div>
          <div className="relative min-w-[180px]">
            <select
              aria-label={t("currency")}
              className={`${selectClass} w-full appearance-none pr-10`}
              disabled={isPending}
              onChange={(event) => changeSelect("currency", event)}
              value={currency ?? ""}
            >
              <option value="">{t("allCurrencies")}</option>
              <option value="THB">THB</option>
              <option value="MMK">MMK</option>
            </select>
            <ChevronDownIcon />
          </div>
          <div className="relative min-w-[180px]">
            <select
              aria-label={`${t("transaction")} ${t("order")}`}
              className={`${selectClass} w-full appearance-none pr-10`}
              disabled={isPending}
              onChange={(event) => changeSelect("order", event)}
              value={order}
            >
              <option value="newest">{t("newestOldest")}</option>
              <option value="oldest">{t("oldestNewest")}</option>
            </select>
            <ChevronDownIcon />
          </div>
          {activeFilterCount > 0 ? (
            <button
              className="ml-auto h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-4 text-xs font-semibold text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60"
              disabled={isPending}
              onClick={resetFilters}
              type="button"
            >
              {t("reset")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="lg:hidden">
        <button
          aria-expanded={mobileOpen}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-none border border-[var(--hairline-soft)] bg-white px-4 text-sm font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          onClick={() => {
            setDateMenuOpen(false);
            setMobileCustomOpen(false);
            setMobileOpen(true);
          }}
          ref={mobileTriggerRef}
          type="button"
        >
          <FilterIcon />
          {t("filters")}
          {activeFilterCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center bg-[var(--primary)] px-1.5 py-0.5 text-[10px] text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-[rgba(0,21,60,0.28)] sm:items-center sm:justify-center sm:p-6"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setMobileOpen(false);
                mobileTriggerRef.current?.focus();
              }
            }}
          >
            <section
              aria-label={t("transactionFilters")}
              aria-modal="true"
              className="max-h-[88vh] w-full overflow-y-auto border border-[var(--hairline)] bg-white sm:max-w-[560px]"
              role="dialog"
            >
              <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
                <h2 className="text-base font-semibold text-[var(--ink)]">{t("filters")}</h2>
                <button
                  aria-label={`${t("close")} ${t("filters")}`}
                  className="inline-flex size-10 items-center justify-center rounded-none border border-[var(--hairline-soft)] text-[var(--ink-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  onClick={() => {
                    setMobileOpen(false);
                    mobileTriggerRef.current?.focus();
                  }}
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="space-y-6 p-5">
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-[var(--ink)]">
                    {t("dateRange")}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {presets.map((preset) => (
                      <button
                        aria-pressed={range === preset.value}
                        className={`${presetClass(range === preset.value)} w-full justify-start`}
                        disabled={isPending}
                        key={preset.value}
                        onClick={() => choosePreset(preset.value, true)}
                        type="button"
                      >
                        {t(preset.label)}
                      </button>
                    ))}
                    <button
                      aria-expanded={mobileCustomOpen}
                      aria-pressed={range === "custom"}
                      className={`${presetClass(range === "custom")} w-full justify-start gap-2`}
                      disabled={isPending}
                      onClick={() => {
                        if (mobileCustomOpen) {
                          setMobileCustomOpen(false);
                        } else {
                          prepareCustomRange();
                          setMobileCustomOpen(true);
                        }
                      }}
                      type="button"
                    >
                      <CalendarIcon />
                      {t("customRange")}
                    </button>
                  </div>
                  {mobileCustomOpen ? (
                    <div className="border-t border-[var(--hairline)] pt-4">{customRangeForm}</div>
                  ) : null}
                </fieldset>

                <div className="grid gap-4 border-t border-[var(--hairline)] pt-5">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                      {t("transactionType")}
                    </span>
                    <div className="relative">
                      <select
                        className={`${selectClass} w-full appearance-none pr-10`}
                        disabled={isPending}
                        onChange={(event) => changeSelect("type", event)}
                        value={type ?? ""}
                      >
                        <option value="">{t("allTypes")}</option>
                        <option value="exchange">{t("exchange")}</option>
                        <option value="cash-bank">{t("cashBank")}</option>
                        <option value="expense">{t("expenses")}</option>
                      </select>
                      <ChevronDownIcon />
                    </div>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                      {t("currency")}
                    </span>
                    <div className="relative">
                      <select
                        className={`${selectClass} w-full appearance-none pr-10`}
                        disabled={isPending}
                        onChange={(event) => changeSelect("currency", event)}
                        value={currency ?? ""}
                      >
                        <option value="">{t("allCurrencies")}</option>
                        <option value="THB">THB</option>
                        <option value="MMK">MMK</option>
                      </select>
                      <ChevronDownIcon />
                    </div>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                      {t("order")}
                    </span>
                    <div className="relative">
                      <select
                        className={`${selectClass} w-full appearance-none pr-10`}
                        disabled={isPending}
                        onChange={(event) => changeSelect("order", event)}
                        value={order}
                      >
                        <option value="newest">{t("newestOldest")}</option>
                        <option value="oldest">{t("oldestNewest")}</option>
                      </select>
                      <ChevronDownIcon />
                    </div>
                  </label>
                </div>

                {activeFilterCount > 0 ? (
                  <button
                    className="h-11 w-full rounded-none border border-[var(--hairline-soft)] bg-white px-4 text-sm font-semibold text-[var(--ink-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60"
                    disabled={isPending}
                    onClick={resetFilters}
                    type="button"
                  >
                    {t("resetFilters")}
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}
