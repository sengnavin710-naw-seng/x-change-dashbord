"use client";

import { useEffect } from "react";

export type RecentTransaction = {
  id: string;
  type: "cash-bank" | "exchange" | "expense";
};

const storageKey = "shwe-lin-pan:recent-transaction";
const highlightLifetime = 10_000;

export function rememberRecentTransaction(transaction: RecentTransaction) {
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        ...transaction,
        expiresAt: Date.now() + highlightLifetime,
      }),
    );
  } catch {
    // The transaction is still saved when session storage is unavailable.
  }
}

export function RecentTransactionHighlighter({ refreshKey }: Readonly<{ refreshKey: string }>) {
  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = window.sessionStorage.getItem(storageKey);
    } catch {
      return;
    }

    if (!stored) return;

    try {
      const transaction = JSON.parse(stored) as RecentTransaction & { expiresAt: number };
      if (transaction.expiresAt < Date.now()) {
        window.sessionStorage.removeItem(storageKey);
        return;
      }

      const key = `${transaction.type}:${transaction.id}`;
      const row = document.querySelector<HTMLElement>(
        `[data-transaction-key="${CSS.escape(key)}"]`,
      );
      if (!row) return;

      window.sessionStorage.removeItem(storageKey);
      row.classList.remove("motion-row-highlight");
      requestAnimationFrame(() => row.classList.add("motion-row-highlight"));

      const timeout = window.setTimeout(() => {
        row.classList.remove("motion-row-highlight");
      }, 1_100);

      return () => window.clearTimeout(timeout);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [refreshKey]);

  return null;
}
