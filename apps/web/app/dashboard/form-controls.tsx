import type { ComponentProps } from "react";

import { Input } from "@repo/ui/input";

export function DateTimeInput({
  className,
  ...props
}: Readonly<Omit<ComponentProps<typeof Input>, "type">>) {
  return (
    <Input
      className={`relative block !w-full min-w-0 !max-w-full appearance-none !pr-12 tabular-nums [inline-size:100%] [max-inline-size:100%] [min-inline-size:0] sm:appearance-auto [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${className ?? ""}`}
      type="datetime-local"
      {...props}
    />
  );
}

export function FormSelect({ className, ...props }: Readonly<ComponentProps<"select">>) {
  return (
    <span className="relative block">
      <select className={`${className ?? ""} appearance-none !pr-12`} {...props} />
      <svg
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[var(--ink-secondary)] ${props.disabled ? "opacity-55" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m7 9.5 5 5 5-5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
        />
      </svg>
    </span>
  );
}
