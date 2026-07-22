import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@repo/auth";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

const accessNotes = [
  {
    index: "01",
    label: "Provisioned identity",
    detail: "Accounts are issued and maintained by your company administrator.",
  },
  {
    index: "02",
    label: "Server-verified sessions",
    detail: "Protected pages and data requests validate your active session.",
  },
  {
    index: "03",
    label: "Restricted workspace",
    detail: "Public registration is disabled for this internal application.",
  },
];

export default async function LoginPage() {
  const session = await getSession(await headers());

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink-slate)]">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
        <section className="relative flex min-h-[420px] flex-col border-b border-[var(--hairline)] px-6 py-6 sm:px-10 sm:py-8 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-12 lg:py-10 xl:px-16 xl:py-12">
          <div className="flex items-center gap-3" aria-label="X-Change">
            <span className="grid size-9 place-items-center rounded-[4px] border border-[var(--primary-dark)] bg-[var(--primary)] text-sm font-semibold text-white">
              X
            </span>
            <span className="text-sm font-semibold tracking-[-0.15px] text-[var(--ink)]">
              X—CHANGE
            </span>
          </div>

          <div className="my-auto max-w-[650px] py-16 lg:py-20">
            <p className="mb-5 text-xs font-semibold tracking-[0.12em] text-[var(--primary)] uppercase">
              Internal operations access
            </p>
            <h1 className="max-w-[620px] font-[var(--font-display)] text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.98] font-medium tracking-[-0.045em] text-[var(--ink)]">
              One secure entry point for your workspace.
            </h1>
            <p className="mt-7 max-w-[560px] text-base leading-7 text-[var(--ink-secondary)] sm:text-lg">
              Sign in with the company credentials assigned to you. Access remains tied to an
              active, provisioned account.
            </p>
          </div>

          <div className="grid border-t border-[var(--hairline)] sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {accessNotes.map((note, index) => (
              <div
                className="border-b border-[var(--hairline)] py-5 last:border-b-0 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0 lg:border-r-0 lg:border-b lg:px-0 lg:last:border-b-0 xl:border-r xl:border-b-0 xl:px-5 xl:first:pl-0 xl:last:border-r-0"
                key={note.index}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--primary)]">{note.index}</span>
                  <span className="text-sm font-semibold text-[var(--ink)]">{note.label}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{note.detail}</p>
                {index === 0 ? (
                  <span className="sr-only">Account status is checked at login.</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-[440px] lg:mx-auto">
            <div className="mb-10 flex items-center justify-between border-b border-[var(--hairline)] pb-4">
              <span className="text-xs font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase">
                Secure access
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-[var(--ink-secondary)]">
                <span className="size-2 bg-[var(--success)]" aria-hidden="true" />
                Authentication online
              </span>
            </div>

            <div className="mb-8">
              <h2 className="font-[var(--font-display)] text-[32px] leading-[1.2] font-medium tracking-[-0.4px] text-[var(--ink)]">
                Sign in
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Use the email and password issued for your account.
              </p>
            </div>

            <LoginForm />

            <p className="mt-8 border-t border-[var(--surface-1)] pt-5 text-xs leading-5 text-[var(--ink-muted)]">
              Need access or a password change? Contact your system administrator. Registration is
              not available from this page.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
