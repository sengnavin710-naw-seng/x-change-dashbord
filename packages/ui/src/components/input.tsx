import type * as React from "react";

import { cn } from "../lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-[4px] border border-[#a9b4c6] bg-[#f9fafb] px-3 py-2 text-base text-[#2c333f] outline-none transition-[border-color,box-shadow] placeholder:text-[#6c7e9d] focus:border-[#2560ff] focus:ring-2 focus:ring-[#e5f2fc] aria-invalid:border-[#ff5757] aria-invalid:focus:border-[#ff5757] aria-invalid:focus:ring-[#fddfdf] disabled:cursor-not-allowed disabled:bg-[#efefef] disabled:text-[#6c7e9d]",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
