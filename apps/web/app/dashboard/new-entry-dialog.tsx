"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/button";

import type { MessageKey } from "@/lib/i18n";

import { useLanguage } from "../language-provider";
import { EntryForm } from "./new/entry-form";
import { rememberRecentTransaction } from "./transaction-motion";

type EntryType = "cash-bank" | "exchange" | "expense";

const labels: Record<EntryType, MessageKey> = {
  "cash-bank": "cashBank",
  exchange: "exchange",
  expense: "expenses",
};

export function NewEntryDialog({
  defaultDate,
  defaultTime,
  type,
}: Readonly<{ defaultDate: string; defaultTime: string; type: EntryType }>) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const label = t(labels[type]);
  const isCompact = type === "expense";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  function showSaved() {
    setShowSavedFeedback(true);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setShowSavedFeedback(false), 2_400);
  }

  function close(force = false) {
    if ((!force && isPending) || isClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsOpen(false);
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 180);
  }

  return (
    <>
      <Button
        onClick={() => {
          setIsClosing(false);
          setIsOpen(true);
        }}
      >
        {t("addTransaction")}
      </Button>
      <dialog
        aria-labelledby={`new-${type}-entry-title`}
        aria-modal="true"
        className={`${isClosing ? "motion-closing " : ""}${
          isCompact
            ? "motion-dialog m-0 h-fit max-h-dvh w-full max-w-none overflow-hidden border-0 bg-white p-0 text-[var(--ink-slate)] backdrop:bg-[#00153c]/55 sm:m-auto sm:max-h-[calc(100dvh_-_3rem)] sm:w-[calc(100vw_-_3rem)] sm:max-w-[760px] sm:border sm:border-[var(--hairline)]"
            : "motion-dialog m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-white p-0 text-[var(--ink-slate)] backdrop:bg-[#00153c]/55 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh_-_3rem)] sm:w-[calc(100vw_-_3rem)] sm:max-w-[760px] sm:border sm:border-[var(--hairline)]"
        }`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          setIsOpen(false);
          setIsClosing(false);
        }}
        ref={dialogRef}
      >
        <div
          className={
            isCompact
              ? "flex h-fit max-h-dvh flex-col bg-white sm:max-h-[calc(100dvh_-_3rem)]"
              : "flex h-dvh flex-col bg-white sm:h-auto sm:max-h-[calc(100dvh_-_3rem)]"
          }
        >
          <header className="flex shrink-0 items-center justify-between gap-5 border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
                {t("addTransaction")}
              </p>
              <h2
                className="mt-1 font-[var(--font-display)] text-xl font-medium text-[var(--ink)]"
                id={`new-${type}-entry-title`}
              >
                {label}
              </h2>
            </div>
            <button
              aria-label={t("close")}
              className="grid size-10 shrink-0 place-items-center rounded-[4px] border border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              onClick={() => close()}
              title={t("close")}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className={`min-h-0 overflow-y-auto ${isCompact ? "" : "flex-1"}`}>
            {isOpen ? (
              <EntryForm
                defaultDate={defaultDate}
                defaultTime={defaultTime}
                embedded
                initialEntryType={type}
                onPendingChange={setIsPending}
                onSaved={(transaction) => {
                  rememberRecentTransaction(transaction);
                  close(true);
                  showSaved();
                }}
                showTypeSelector={false}
              />
            ) : null}
          </div>
        </div>
      </dialog>
      {showSavedFeedback ? (
        <div
          aria-live="polite"
          className="motion-status fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] border border-[var(--success)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)] shadow-[0_12px_32px_rgba(0,21,60,0.16)]"
          role="status"
        >
          {t("transactionSaved")}
        </div>
      ) : null}
    </>
  );
}
