import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TRPCProvider } from "@/trpc/provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "X-Change",
    template: "%s · X-Change",
  },
  description: "Internal X-Change operations workspace",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
