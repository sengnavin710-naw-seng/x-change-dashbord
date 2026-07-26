"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/button";

import { BalanceConfigurationForm, type BalanceConfiguration } from "./opening-form";
import { useLanguage } from "../../language-provider";

export function BalanceConfigurationDialog({
  defaultCheckpointDate,
  initial,
}: Readonly<{
  defaultCheckpointDate: string;
  initial: BalanceConfiguration | null;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isPending, setIsPending] = useState(false);

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
    },
    [],
  );

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
        {t("setUpBalance")}
      </Button>
      <dialog
        aria-labelledby="edit-balance-title"
        aria-modal="true"
        className={`${isClosing ? "motion-closing " : ""}motion-dialog m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-white p-0 text-[var(--ink-slate)] backdrop:bg-[#00153c]/55 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh_-_3rem)] sm:w-[calc(100vw_-_3rem)] sm:max-w-[900px] sm:border sm:border-[var(--hairline)]`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => {
          setIsOpen(false);
          setIsClosing(false);
        }}
        ref={dialogRef}
      >
        <div className="flex h-dvh flex-col bg-white sm:h-auto sm:max-h-[calc(100dvh_-_3rem)]">
          <header className="flex shrink-0 items-center justify-between gap-5 border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
                {t("balanceSetup")}
              </p>
              <h2
                className="mt-1 font-[var(--font-display)] text-xl font-medium text-[var(--ink)]"
                id="edit-balance-title"
              >
                {t("setUpBalance")}
              </h2>
            </div>
            <button
              aria-label={`${t("close")} ${t("balanceSetup")}`}
              className="grid size-10 shrink-0 place-items-center rounded-none border border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            {isOpen ? (
              <BalanceConfigurationForm
                defaultCheckpointDate={defaultCheckpointDate}
                embedded
                initial={initial}
                onPendingChange={setIsPending}
                onSaved={() => close(true)}
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
