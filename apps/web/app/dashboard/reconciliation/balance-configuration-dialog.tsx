"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/button";

import { BalanceConfigurationForm, type BalanceConfiguration } from "./opening-form";

export function BalanceConfigurationDialog({
  defaultCheckpointDate,
  initial,
}: Readonly<{
  defaultCheckpointDate: string;
  initial: BalanceConfiguration;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
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

  function close() {
    if (!isPending) setIsOpen(false);
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Edit Balance</Button>
      <dialog
        aria-labelledby="edit-balance-title"
        aria-modal="true"
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-white p-0 text-[var(--ink-slate)] backdrop:bg-[#00153c]/55 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh_-_3rem)] sm:w-[calc(100vw_-_3rem)] sm:max-w-[680px] sm:border sm:border-[var(--hairline)]"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <div className="flex h-dvh flex-col bg-white sm:h-auto sm:max-h-[calc(100dvh_-_3rem)]">
          <header className="flex shrink-0 items-center justify-between gap-5 border-b border-[var(--hairline)] bg-[#f4f7fb] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--primary)] uppercase">
                Opening / Closing Balance
              </p>
              <h2
                className="mt-1 font-[var(--font-display)] text-xl font-medium text-[var(--ink)]"
                id="edit-balance-title"
              >
                Edit Balance Setup
              </h2>
            </div>
            <button
              aria-label="Close balance setup"
              className="grid size-10 shrink-0 place-items-center rounded-none border border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              onClick={close}
              title="Close"
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isOpen ? (
              <BalanceConfigurationForm
                defaultCheckpointDate={defaultCheckpointDate}
                embedded
                initial={initial}
                onPendingChange={setIsPending}
                onSaved={() => setIsOpen(false)}
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
