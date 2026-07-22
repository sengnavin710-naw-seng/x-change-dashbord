"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { normalizeMoneyInput } from "@repo/api/operations";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { trpc } from "@/trpc/client";

interface BalanceConfiguration {
  calculationStartDate: string;
  checkpointMmk: string;
  checkpointThb: string;
  note: string | null;
  openingMmk: string;
  openingThb: string;
}

const moneyFields = ["openingThb", "openingMmk", "checkpointThb", "checkpointMmk"] as const;
const moneyPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const moneyFieldError = "Use numbers with up to 4 decimals.";

type MoneyField = (typeof moneyFields)[number];
type MoneyFieldErrors = Partial<Record<MoneyField, string>>;

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function nextCalendarDate(date: string) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function submissionError(cause: unknown) {
  if (!(cause instanceof Error)) return "Unable to save balance setup.";
  if (cause.message.includes("invalid_format")) return "Check the highlighted amount fields.";
  return cause.message;
}

export function BalanceConfigurationForm({
  defaultCheckpointDate,
  initial,
}: Readonly<{
  defaultCheckpointDate: string;
  initial: BalanceConfiguration | null;
}>) {
  const router = useRouter();
  const mutation = trpc.operations.saveBalanceConfiguration.useMutation();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MoneyFieldErrors>({});

  function clearFieldError(field: MoneyField) {
    setError(null);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    const amounts: Record<MoneyField, string> = {
      checkpointMmk: normalizeMoneyInput(value(form, "checkpointMmk")),
      checkpointThb: normalizeMoneyInput(value(form, "checkpointThb")),
      openingMmk: normalizeMoneyInput(value(form, "openingMmk")),
      openingThb: normalizeMoneyInput(value(form, "openingThb")),
    };
    const nextFieldErrors: MoneyFieldErrors = {};

    for (const field of moneyFields) {
      if (!moneyPattern.test(amounts[field])) nextFieldErrors[field] = moneyFieldError;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Check the highlighted amount fields.");
      return;
    }

    setFieldErrors({});

    try {
      await mutation.mutateAsync({
        ...amounts,
        calculationStartDate: nextCalendarDate(value(form, "checkpointDate")),
        note: value(form, "note") || undefined,
        reason: value(form, "reason") || undefined,
      });
      setMessage("Balance setup saved.");
      router.refresh();
    } catch (cause) {
      setError(submissionError(cause));
    }
  }

  return (
    <form className="max-w-[720px] border border-[var(--hairline)] bg-white" onSubmit={submit}>
      <div className="border-b border-[var(--hairline)] px-5 py-4 sm:px-7">
        <h2 className="text-lg font-semibold text-[var(--ink)]">
          {initial ? "Edit Balance Setup" : "Set Up Balances"}
        </h2>
      </div>
      <div className="grid gap-5 p-5 sm:p-7 [&>label]:block">
        <MoneyField
          defaultValue={initial?.openingThb}
          disabled={mutation.isPending}
          error={fieldErrors.openingThb}
          label="Opening Balance THB"
          name="openingThb"
          onChange={() => clearFieldError("openingThb")}
          placeholder="235,299"
        />
        <MoneyField
          defaultValue={initial?.openingMmk}
          disabled={mutation.isPending}
          error={fieldErrors.openingMmk}
          label="Opening Balance MMK"
          name="openingMmk"
          onChange={() => clearFieldError("openingMmk")}
          placeholder="5,918,129"
        />
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            Previous Closing Date
          </span>
          <Input
            defaultValue={defaultCheckpointDate}
            disabled={mutation.isPending}
            name="checkpointDate"
            required
            type="date"
          />
        </label>
        <MoneyField
          defaultValue={initial?.checkpointThb}
          disabled={mutation.isPending}
          error={fieldErrors.checkpointThb}
          label="Previous Closing Balance THB"
          name="checkpointThb"
          onChange={() => clearFieldError("checkpointThb")}
          placeholder="128,200"
        />
        <MoneyField
          defaultValue={initial?.checkpointMmk}
          disabled={mutation.isPending}
          error={fieldErrors.checkpointMmk}
          label="Previous Closing Balance MMK"
          name="checkpointMmk"
          onChange={() => clearFieldError("checkpointMmk")}
          placeholder="17,407,355"
        />
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-[var(--ink)]">Note (Optional)</span>
          <Input
            defaultValue={initial?.note ?? ""}
            disabled={mutation.isPending}
            maxLength={500}
            name="note"
          />
        </label>
        {initial ? (
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-[var(--ink)]">
              Edit Reason (Optional)
            </span>
            <Input disabled={mutation.isPending} maxLength={500} name="reason" />
          </label>
        ) : null}
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
          {mutation.isPending ? "Saving…" : "Save Balance Setup"}
        </Button>
      </div>
    </form>
  );
}

function MoneyField({
  defaultValue,
  disabled,
  error,
  label,
  name,
  onChange,
  placeholder,
}: Readonly<{
  defaultValue: string | undefined;
  disabled: boolean;
  error: string | undefined;
  label: string;
  name: MoneyField;
  onChange: () => void;
  placeholder: string;
}>) {
  const errorId = `${name}-error`;

  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        defaultValue={defaultValue}
        disabled={disabled}
        inputMode="decimal"
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required
      />
      {error ? (
        <span className="block text-xs text-[var(--error)]" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
