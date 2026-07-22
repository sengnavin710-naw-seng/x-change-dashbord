"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { getYangonDateTime, toYangonIso } from "@/lib/exchange-rate";
import { trpc } from "@/trpc/client";

const selectClass =
  "h-11 w-full rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]";

interface ExpenseRecord {
  amount: string;
  currency: "MMK" | "THB";
  description: string;
  id: string;
  transactionAt: string;
  transactionDate: string;
}

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function EditExpenseForm({ record }: Readonly<{ record: ExpenseRecord }>) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const mutation = trpc.operations.updateExpense.useMutation();
  const [error, setError] = useState<string | null>(null);
  const initialDateTime = getYangonDateTime(new Date(record.transactionAt));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await mutation.mutateAsync({
        amount: value(form, "amount"),
        currency: value(form, "currency") as ExpenseRecord["currency"],
        description: value(form, "description"),
        id: record.id,
        reason: value(form, "reason"),
        transactionAt: toYangonIso(value(form, "transactionDate"), value(form, "transactionTime")),
      });
      await utils.dashboard.today.invalidate();
      router.push("/dashboard/expenses");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update record");
    }
  }

  return (
    <form className="max-w-[720px] border border-[var(--hairline)] bg-white" onSubmit={submit}>
      <div className="grid gap-5 p-5 sm:p-7 [&>label]:block">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Date</span>
          <Input
            defaultValue={record.transactionDate}
            disabled={mutation.isPending}
            name="transactionDate"
            required
            type="date"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Time</span>
          <Input
            defaultValue={initialDateTime.time}
            disabled={mutation.isPending}
            name="transactionTime"
            required
            type="time"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Currency</span>
          <select
            className={selectClass}
            defaultValue={record.currency}
            disabled={mutation.isPending}
            name="currency"
          >
            <option value="THB">THB</option>
            <option value="MMK">MMK</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Amount</span>
          <Input
            defaultValue={record.amount}
            disabled={mutation.isPending}
            inputMode="decimal"
            name="amount"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Particular</span>
          <Input
            defaultValue={record.description}
            disabled={mutation.isPending}
            name="description"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Edit Reason</span>
          <Input disabled={mutation.isPending} minLength={3} name="reason" required />
        </label>
      </div>
      {error ? (
        <p
          className="mx-5 mb-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-3 text-sm sm:mx-7"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
        <Button
          disabled={mutation.isPending}
          onClick={() => router.back()}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Updating…" : "Update Record"}
        </Button>
      </div>
    </form>
  );
}
