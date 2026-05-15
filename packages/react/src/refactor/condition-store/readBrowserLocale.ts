import { getCookieValue } from "./cookies";
import { getI18nManager } from "@generaltranslation/react-core/context";

export function readBrowserLocale(localeCookieName: string): string[] {
  const candidates = [];
  // (1) Check cookie

  const cookieLocale = getCookieValue({
    cookieName: localeCookieName,
  });
  if (cookieLocale) candidates.push(cookieLocale);

  // (2) Check navigator locales
  const navigatorLocales = navigator?.languages || [];
  candidates.push(...navigatorLocales);

  return candidates;
}
