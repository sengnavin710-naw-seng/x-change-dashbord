"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

const filterButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-wait disabled:opacity-60";

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

export function SingleDateFilter({
  ariaLabel,
  date,
  filterId,
  maximumDate,
}: Readonly<{
  ariaLabel: string;
  date: string;
  filterId: string;
  maximumDate: string;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);
  const [isPending, startTransition] = useTransition();

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
        Filter Date
      </button>

      {isOpen ? (
        <div
          aria-label={ariaLabel}
          className="absolute top-full right-0 z-30 mt-2 w-[280px] max-w-[calc(100vw-2rem)] border border-[var(--hairline)] bg-white shadow-[0_12px_32px_rgba(0,21,60,0.12)]"
          id={filterId}
          role="dialog"
        >
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ink)]">Date Filter</p>
          </div>
          <form className="space-y-4 p-4" onSubmit={applyDate}>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink-secondary)]">Date</span>
              <input
                className="h-10 rounded-none border border-[var(--hairline-soft)] bg-white px-3 text-sm tabular-nums text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]"
                max={maximumDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                required
                type="date"
                value={selectedDate}
              />
            </label>
            <button
              className="h-10 w-full rounded-none border border-[var(--primary-dark)] bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              Apply
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
