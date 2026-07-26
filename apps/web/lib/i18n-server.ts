import { cookies } from "next/headers";

import { isLanguage, LANGUAGE_COOKIE, translate, type Language, type MessageKey } from "./i18n";

export async function getServerLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : "en";
}

export async function getServerTranslator() {
  const language = await getServerLanguage();
  return {
    language,
    t: (key: MessageKey) => translate(language, key),
  };
}
