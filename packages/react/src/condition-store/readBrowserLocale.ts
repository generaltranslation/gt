import { getCookieValue } from './cookies';

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
