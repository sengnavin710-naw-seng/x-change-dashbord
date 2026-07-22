"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { trpc } from "@/trpc/client";

const selectClass =
  "h-11 w-full rounded-[4px] border border-[var(--hairline-soft)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)/0.2]";

interface CashBankRecord {
  currency: "MMK" | "THB";
  description: string | null;
  direction: "bank-to-cash" | "cash-to-bank";
  feeRate: string;
  id: string;
  principalAmount: string;
  transactionDate: string;
}

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function EditCashBankForm({ record }: Readonly<{ record: CashBankRecord }>) {
  const router = useRouter();
  const mutation = trpc.operations.updateCashBank.useMutation();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await mutation.mutateAsync({
        currency: value(form, "currency") as CashBankRecord["currency"],
        description: value(form, "description") || undefined,
        direction: value(form, "direction") as CashBankRecord["direction"],
        feeRate: value(form, "feeRate"),
        id: record.id,
        principalAmount: value(form, "principalAmount"),
        reason: value(form, "reason"),
        transactionDate: value(form, "transactionDate"),
      });
      router.push("/dashboard/cash-bank");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "စာရင်းကို ပြင်၍မရပါ");
    }
  }

  return (
    <form className="max-w-[780px] border border-[var(--hairline)] bg-white" onSubmit={submit}>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">ရက်စွဲ / Date</span>
          <Input
            defaultValue={record.transactionDate}
            disabled={mutation.isPending}
            name="transactionDate"
            required
            type="date"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">ငွေကြေး / Currency</span>
          <select
            className={selectClass}
            defaultValue={record.currency}
            disabled={mutation.isPending}
            name="currency"
          >
            <option value="MMK">MMK</option>
            <option value="THB">THB</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            လမ်းကြောင်း / Direction
          </span>
          <select
            className={selectClass}
            defaultValue={record.direction}
            disabled={mutation.isPending}
            name="direction"
          >
            <option value="bank-to-cash">Bank In → Cash Out</option>
            <option value="cash-to-bank">Cash In → Bank Out</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            ဝန်ဆောင်ခ / Fee rate
          </span>
          <select
            className={selectClass}
            defaultValue={record.feeRate}
            disabled={mutation.isPending}
            name="feeRate"
          >
            <option value="0.01">1%</option>
            <option value="0.02">2%</option>
            <option value="0.03">3%</option>
          </select>
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            မူရင်းငွေ / Principal amount
          </span>
          <Input
            defaultValue={record.principalAmount}
            disabled={mutation.isPending}
            inputMode="decimal"
            name="principalAmount"
            required
          />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            မှတ်ချက် / Description
          </span>
          <Input
            defaultValue={record.description ?? ""}
            disabled={mutation.isPending}
            name="description"
          />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            ပြင်ဆင်ရသည့်အကြောင်းရင်း / Edit reason
          </span>
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
          မလုပ်တော့ပါ / Cancel
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "ပြင်နေသည်… / Updating…" : "ပြင်ဆင်ရန် / Update record"}
        </Button>
      </div>
    </form>
  );
}
