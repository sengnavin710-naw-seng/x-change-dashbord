import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getServerLanguage } from "@/lib/i18n-server";
import { TRPCProvider } from "@/trpc/provider";

import { LanguageProvider } from "./language-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "X-Change",
    template: "%s · X-Change",
  },
  description: "Internal X-Change operations workspace",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const language = await getServerLanguage();

  return (
    <html lang={language === "my" ? "my" : "en"}>
      <body>
        <LanguageProvider initialLanguage={language}>
          <TRPCProvider>{children}</TRPCProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
