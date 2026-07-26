import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@repo/auth";

import { getServerTranslator } from "@/lib/i18n-server";

import { LanguageSwitcher } from "../language-switcher";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSession(await headers());
  const { t } = await getServerTranslator();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--surface-2)] px-4 py-8 text-[var(--ink-slate)] sm:px-6 sm:py-10">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LanguageSwitcher iconOnly />
      </div>
      <section className="w-full max-w-[520px] rounded-[8px] border border-[var(--hairline)] bg-[var(--canvas)] px-6 py-8 sm:px-12 sm:py-12">
        <div className="w-full">
          <header className="mb-8 text-center">
            <h1 className="font-[var(--font-display)] text-2xl leading-[1.2] font-semibold tracking-[-0.3px] text-[var(--ink)]">
              {t("welcome")}
            </h1>
          </header>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
