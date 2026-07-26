"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useLanguage } from "../language-provider";
import { DashboardNavigation } from "./navigation";
import { SignOutButton } from "./sign-out-button";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: Readonly<AdminShellProps>) {
  const { language, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const closeMobileMenu = useCallback((restoreFocus = true) => {
    setMobileMenuOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }
  }, []);

  function openMobileMenu() {
    setMobileMenuOpen(true);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileMenu();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements.at(0);
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileMenu, mobileMenuOpen]);

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] text-[var(--ink-slate)]"
      lang={language === "my" ? "my" : "en"}
    >
      <header className="border-b border-[var(--hairline)] bg-[var(--canvas)] px-4 sm:px-6 lg:hidden">
        <div className="flex h-16 items-center gap-3">
          <button
            aria-label={t("menu")}
            aria-controls="mobile-dashboard-navigation"
            aria-expanded={mobileMenuOpen}
            className="grid size-11 shrink-0 place-items-center rounded-[4px] border border-[var(--hairline-soft)] bg-white text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            onClick={openMobileMenu}
            ref={menuTriggerRef}
            type="button"
          >
            <MenuIcon />
          </button>
          <Link
            className="text-base font-semibold tracking-[-0.2px] text-[var(--ink)]"
            href="/dashboard"
          >
            SHWE LIN PAN
          </Link>
        </div>
      </header>

      <div
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 z-40 lg:hidden ${
          mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          aria-label={t("close")}
          className={`absolute inset-0 bg-[rgba(0,21,60,0.42)] transition-opacity duration-200 motion-reduce:transition-none ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => closeMobileMenu()}
          tabIndex={-1}
          type="button"
        />

        <aside
          aria-label={t("menu")}
          aria-modal="true"
          className={`relative flex h-full w-[min(86vw,320px)] flex-col border-r border-[var(--hairline)] bg-[#f4f7fb] shadow-[12px_0_32px_rgba(0,21,60,0.16)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          id="mobile-dashboard-navigation"
          inert={!mobileMenuOpen}
          ref={drawerRef}
          role="dialog"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--hairline)] px-4">
            <Link
              className="text-base font-semibold tracking-[-0.2px] text-[var(--ink)]"
              href="/dashboard"
              onClick={() => closeMobileMenu(false)}
            >
              SHWE LIN PAN
            </Link>
            <button
              aria-label={t("close")}
              className="grid size-11 shrink-0 place-items-center rounded-[4px] border border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              onClick={() => closeMobileMenu()}
              ref={closeButtonRef}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="scrollbar-hidden flex-1 overflow-y-auto overscroll-contain px-3 py-5">
            <DashboardNavigation mobile onNavigate={() => closeMobileMenu(false)} />
          </div>

          <div className="shrink-0 p-4">
            <SignOutButton />
          </div>
        </aside>
      </div>

      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-[var(--hairline)] bg-[#f4f7fb] lg:flex lg:flex-col">
        <Link
          className="flex h-[82px] items-center border-b border-[var(--hairline)] px-6 text-lg font-semibold tracking-[-0.25px] text-[var(--ink)]"
          href="/dashboard"
        >
          SHWE LIN PAN
        </Link>

        <div className="scrollbar-hidden flex-1 overflow-y-auto overscroll-contain px-3 py-6">
          <DashboardNavigation />
        </div>

        <div className="grid gap-3 p-4">
          <SignOutButton />
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
