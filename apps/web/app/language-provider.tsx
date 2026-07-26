"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { LANGUAGE_COOKIE, translate, type Language, type MessageKey } from "@/lib/i18n";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage,
}: Readonly<{ children: ReactNode; initialLanguage: Language }>) {
  const router = useRouter();
  const [language, setLanguageState] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "my" ? "my" : "en";
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage(nextLanguage) {
        setLanguageState(nextLanguage);
        document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.localStorage.setItem(LANGUAGE_COOKIE, nextLanguage);
        router.refresh();
      },
      t: (key) => translate(language, key),
    }),
    [language, router],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
