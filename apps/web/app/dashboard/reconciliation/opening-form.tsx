"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { trpc } from "@/trpc/client";

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function OpeningBalanceForm({ defaultDate }: Readonly<{ defaultDate: string }>) {
  const router = useRouter();
  const mutation = trpc.operations.createOpeningBalance.useMutation();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);

    try {
      await mutation.mutateAsync({
        effectiveDate: value(form, "effectiveDate"),
        note: value(form, "note") || undefined,
        operationalMmk: value(form, "operationalMmk"),
        operationalThb: value(form, "operationalThb"),
        referenceMmk: value(form, "referenceMmk"),
        referenceThb: value(form, "referenceThb"),
      });
      setMessage(
        "အဖွင့်လက်ကျန်ကို သီးခြားနှစ်စုံအဖြစ် သိမ်းပြီးပါပြီ / Opening figures saved separately",
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "အဖွင့်လက်ကျန်ကို မသိမ်းနိုင်ပါ");
    }
  }

  return (
    <form className="border border-[var(--hairline)] bg-white" onSubmit={submit}>
      <div className="border-b border-[var(--hairline)] px-5 py-5 sm:px-7">
        <h2 className="text-lg font-semibold text-[var(--ink)]">အဖွင့်လက်ကျန် သတ်မှတ်ရန်</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Configure unreconciled opening balances
        </p>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            စတင်ရက် / Effective date
          </span>
          <Input
            defaultValue={defaultDate}
            disabled={mutation.isPending}
            name="effectiveDate"
            required
            type="date"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            အညွှန်း ဘတ် / Reference THB
          </span>
          <Input disabled={mutation.isPending} inputMode="decimal" name="referenceThb" required />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            အညွှန်း ကျပ် / Reference MMK
          </span>
          <Input disabled={mutation.isPending} inputMode="decimal" name="referenceMmk" required />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            လုပ်ငန်းသုံး ဘတ် / Operational THB
          </span>
          <Input disabled={mutation.isPending} inputMode="decimal" name="operationalThb" required />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            လုပ်ငန်းသုံး ကျပ် / Operational MMK
          </span>
          <Input disabled={mutation.isPending} inputMode="decimal" name="operationalMmk" required />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">မှတ်ချက် / Note</span>
          <Input disabled={mutation.isPending} name="note" />
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
      {message ? (
        <p
          className="mx-5 mb-5 border-l-4 border-[var(--success)] bg-[#e8f8f0] p-3 text-sm sm:mx-7"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <div className="flex justify-end border-t border-[var(--hairline)] bg-[#f9fafb] px-5 py-4 sm:px-7">
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "သိမ်းနေသည်… / Saving…" : "သိမ်းရန် / Save opening"}
        </Button>
      </div>
    </form>
  );
}
