"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { useLanguage } from "../language-provider";
import { useMotionPresence } from "../use-motion-presence";

const filterButtonClass =
  "inline-flex h-11 max-w-[10rem] items-center justify-center gap-2 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60 sm:h-9 sm:max-w-none";

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

function formatSelectedDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function SingleDateFilter({
  ariaLabel,
  date,
  displaySelectedDate = false,
  filterId,
  maximumDate,
}: Readonly<{
  ariaLabel: string;
  date: string;
  displaySelectedDate?: boolean;
  filterId: string;
  maximumDate: string;
}>) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);
  const [isPending, startTransition] = useTransition();
  const filterPresence = useMotionPresence(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggleFilter() {
    if (!isOpen) setSelectedDate(date);
    setIsOpen(!isOpen);
  }

  function applyDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDate || selectedDate > maximumDate) return;

    const params = new URLSearchParams(searchParams.toString());
    if (selectedDate === maximumDate) {
      params.delete("date");
    } else {
      params.set("date", selectedDate);
    }
    const query = params.toString();
    setIsOpen(false);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={filterId}
        aria-expanded={isOpen}
        className={filterButtonClass}
        disabled={isPending}
        onClick={toggleFilter}
        ref={triggerRef}
        type="button"
      >
        <CalendarIcon />
        <span className="truncate">
          {displaySelectedDate ? formatSelectedDate(date) : t("filterDate")}
        </span>
      </button>

      {filterPresence.present ? (
        <>
          <button
            aria-hidden="true"
            className={`motion-disclosure-backdrop fixed inset-0 z-40 bg-[rgba(0,21,60,0.18)] sm:hidden ${
              filterPresence.visible ? "motion-disclosure-open" : ""
            }`}
            onClick={() => setIsOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-hidden={!filterPresence.visible}
            aria-label={ariaLabel}
            className={`motion-disclosure fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 max-h-[min(78dvh,24rem)] overflow-y-auto overscroll-contain border border-[var(--hairline)] bg-white shadow-[0_12px_32px_rgba(0,21,60,0.16)] sm:absolute sm:top-full sm:right-0 sm:bottom-auto sm:left-auto sm:z-30 sm:mt-2 sm:w-[280px] sm:max-w-[calc(100vw-2rem)] ${
              filterPresence.visible ? "motion-disclosure-open" : ""
            }`}
            id={filterId}
            role="dialog"
          >
            <div className="flex min-h-11 items-center justify-between border-b border-[var(--hairline)] px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{t("dateFilter")}</p>
              <button
                aria-label={t("close")}
                className="inline-flex size-10 items-center justify-center border border-[var(--hairline-soft)] bg-white text-xl leading-none text-[var(--ink-secondary)] hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:hidden"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="space-y-3 p-3 sm:space-y-4 sm:p-4" onSubmit={applyDate}>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                  {t("date")}
                </span>
                <input
                  className="h-11 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2] sm:h-10"
                  max={maximumDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  required
                  type="date"
                  value={selectedDate}
                />
              </label>
              <button
                className="h-11 w-full rounded-none border border-[var(--primary-dark)] bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:h-10"
                disabled={isPending}
                type="submit"
              >
                {t("apply")}
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
