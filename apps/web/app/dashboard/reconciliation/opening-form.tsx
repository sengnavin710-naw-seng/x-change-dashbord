"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";

import { normalizeMoneyInput } from "@repo/api/operations";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

import { trpc } from "@/trpc/client";
import { useLanguage } from "../../language-provider";
import { LoadingSpinner } from "../form-controls";

export interface BalanceConfiguration {
  calculationStartDate: string;
  checkpointMmk: string;
  checkpointThb: string;
  note: string | null;
  openingMmk: string;
  openingThb: string;
}

const moneyFields = ["openingThb", "openingMmk", "checkpointThb", "checkpointMmk"] as const;
const moneyPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
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

function submissionError(cause: unknown, fallback: string, invalidAmountMessage: string) {
  if (!(cause instanceof Error)) return fallback;
  if (cause.message.includes("invalid_format")) return invalidAmountMessage;
  return cause.message;
}

function formatMoneyInput(value: string | undefined) {
  if (!value) return undefined;

  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;

  const whole = new Intl.NumberFormat("en-US").format(BigInt(match[1] ?? "0"));
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function showDatePicker(input: HTMLInputElement) {
  if (input.disabled || typeof input.showPicker !== "function") return false;

  input.focus({ preventScroll: true });

  try {
    input.showPicker();
    return true;
  } catch {
    // The native date input remains usable when a browser does not expose showPicker.
    return false;
  }
}

function handleDatePickerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter" && event.key !== " ") return;

  if (showDatePicker(event.currentTarget)) event.preventDefault();
}

function handleDatePickerPointerDown(event: PointerEvent<HTMLInputElement>) {
  if (showDatePicker(event.currentTarget)) event.preventDefault();
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="pointer-events-none size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function BalanceConfigurationForm({
  defaultCheckpointDate,
  embedded = false,
  initial,
  onPendingChange,
  onSaved,
}: Readonly<{
  defaultCheckpointDate: string;
  embedded?: boolean;
  initial: BalanceConfiguration | null;
  onPendingChange?: (pending: boolean) => void;
  onSaved?: () => void;
}>) {
  const router = useRouter();
  const { t } = useLanguage();
  const mutation = trpc.operations.saveBalanceConfiguration.useMutation();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MoneyFieldErrors>({});

  useEffect(() => {
    onPendingChange?.(mutation.isPending);
  }, [mutation.isPending, onPendingChange]);

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
      if (!moneyPattern.test(amounts[field])) {
        nextFieldErrors[field] = t("useNumbersUpToFourDecimals");
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(t("checkHighlightedAmounts"));
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
      router.refresh();
      if (onSaved) {
        onSaved();
      } else {
        setMessage(t("balanceSetupSaved"));
      }
    } catch (cause) {
      setError(submissionError(cause, t("unableToSaveBalanceSetup"), t("checkHighlightedAmounts")));
    }
  }

  return (
    <form className="w-full max-w-[840px]" onSubmit={submit}>
      <div className="grid items-start gap-5 lg:grid-cols-[360px_460px]">
        <fieldset className="min-w-0 border border-[var(--hairline)] bg-white">
          <legend className="sr-only">{t("openingBalance")}</legend>
          <div className="border-b border-[var(--hairline)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--ink)]">{t("openingBalance")}</h2>
          </div>
          <div className="grid gap-5 p-5">
            <MoneyField
              defaultValue={initial?.openingThb}
              disabled={mutation.isPending}
              error={fieldErrors.openingThb}
              label="THB"
              name="openingThb"
              onChange={() => clearFieldError("openingThb")}
            />
            <MoneyField
              defaultValue={initial?.openingMmk}
              disabled={mutation.isPending}
              error={fieldErrors.openingMmk}
              label="MMK"
              name="openingMmk"
              onChange={() => clearFieldError("openingMmk")}
            />
          </div>
        </fieldset>

        <fieldset className="min-w-0 border border-[var(--hairline)] bg-white">
          <legend className="sr-only">{t("currencyExchangeBalance")}</legend>
          <div className="border-b border-[var(--hairline)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--ink)]">
              {t("currencyExchangeBalance")}
            </h2>
          </div>
          <div className="grid gap-5 p-5">
            <label className="min-w-0 space-y-2">
              <span className="block text-sm font-semibold text-[var(--ink)]">
                {t("balanceDate")}
              </span>
              <span className="relative block min-w-0 max-w-full">
                <Input
                  className="relative block !w-full min-w-0 !max-w-full cursor-pointer appearance-none !pr-11 tabular-nums [inline-size:100%] [max-inline-size:100%] [min-inline-size:0] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  defaultValue={defaultCheckpointDate}
                  disabled={mutation.isPending}
                  name="checkpointDate"
                  onKeyDown={handleDatePickerKeyDown}
                  onPointerDown={handleDatePickerPointerDown}
                  required
                  type="date"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--ink-secondary)]">
                  <CalendarIcon />
                </span>
              </span>
            </label>
            <MoneyField
              defaultValue={initial?.checkpointThb}
              disabled={mutation.isPending}
              error={fieldErrors.checkpointThb}
              label="THB"
              name="checkpointThb"
              onChange={() => clearFieldError("checkpointThb")}
            />
            <MoneyField
              defaultValue={initial?.checkpointMmk}
              disabled={mutation.isPending}
              error={fieldErrors.checkpointMmk}
              label="MMK"
              name="checkpointMmk"
              onChange={() => clearFieldError("checkpointMmk")}
            />
            <div className="grid gap-5 border-t border-[var(--hairline)] pt-5">
              <label className="space-y-2">
                <span className="block text-sm font-semibold text-[var(--ink)]">
                  {t("noteOptional")}
                </span>
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
                    {t("reasonForChangeOptional")}
                  </span>
                  <Input disabled={mutation.isPending} maxLength={500} name="reason" />
                </label>
              ) : null}
            </div>
          </div>
        </fieldset>
      </div>
      {error ? (
        <p
          className="mt-5 border-l-4 border-[var(--error)] bg-[var(--error-bg)] p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="mt-5 border-l-4 border-[var(--success)] bg-[#e8f8f0] p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <div
        className={`${embedded ? "sticky bottom-0" : ""} mt-5 flex justify-end border border-[var(--hairline)] bg-[#f9fafb] px-5 py-4`}
      >
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? (
            <>
              <LoadingSpinner className="mr-2" />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
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
}: Readonly<{
  defaultValue: string | undefined;
  disabled: boolean;
  error: string | undefined;
  label: string;
  name: MoneyField;
  onChange: () => void;
}>) {
  const errorId = `${name}-error`;

  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        defaultValue={formatMoneyInput(defaultValue)}
        disabled={disabled}
        inputMode="decimal"
        name={name}
        onChange={onChange}
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
