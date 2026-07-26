"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Language } from "../lib/i18n";
import { useLanguage } from "./language-provider";
import { useMotionPresence } from "./use-motion-presence";

export function LanguageSwitcher({
  iconOnly = false,
  navigation = false,
}: Readonly<{ iconOnly?: boolean; navigation?: boolean }>) {
  const { language, setLanguage, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const menuPresence = useMotionPresence(open);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function chooseLanguage(nextLanguage: Language) {
    setOpen(false);
    if (nextLanguage !== language) setLanguage(nextLanguage);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label={iconOnly ? t("changeLanguage") : undefined}
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          navigation
            ? "grid w-full grid-cols-[22px_minmax(0,1fr)] items-center gap-3 border-l-2 border-transparent px-3 py-3 text-left text-[var(--ink-secondary)] transition-colors hover:border-[var(--hairline-soft)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset"
            : iconOnly
              ? "grid size-11 place-items-center border border-[var(--hairline-soft)] bg-white text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              : "flex h-10 items-center gap-3 border border-[var(--hairline-soft)] bg-white px-3 text-sm font-semibold text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        }
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={iconOnly ? t("changeLanguage") : undefined}
        type="button"
      >
        <GlobeIcon />
        {iconOnly ? null : (
          <span className="text-sm font-semibold leading-5">{t("changeLanguage")}</span>
        )}
      </button>

      {menuPresence.present ? (
        <div
          aria-hidden={!menuPresence.visible}
          aria-label={t("language")}
          className={`motion-disclosure absolute z-50 w-[200px] border border-[var(--hairline)] bg-white p-1 shadow-[0_12px_32px_rgba(0,21,60,0.12)] ${
            menuPresence.visible ? "motion-disclosure-open" : ""
          } ${navigation ? "bottom-full left-3 mb-1" : "top-full right-0 mt-1"}`}
          id={menuId}
          role="menu"
        >
          <LanguageOption
            active={language === "en"}
            label={t("english")}
            onClick={() => chooseLanguage("en")}
          />
          <LanguageOption
            active={language === "my"}
            label={t("myanmar")}
            onClick={() => chooseLanguage("my")}
          />
        </div>
      ) : null}
    </div>
  );
}

function LanguageOption({
  active,
  label,
  onClick,
}: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return (
    <button
      aria-checked={active}
      className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left text-sm font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset"
      onClick={onClick}
      role="menuitemradio"
      type="button"
    >
      <span>{label}</span>
      {active ? <CheckIcon /> : null}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[17px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.2 2.45 3.4 5.46 3.4 9S14.2 18.55 12 21M12 3C9.8 5.45 8.6 8.46 8.6 12S9.8 18.55 12 21" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-[var(--primary)]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
