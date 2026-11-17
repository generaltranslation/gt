import { getCookieValue } from './cookies';
import { oncePerTask } from './oncePerTask';

const navigatorLocales = oncePerTask<readonly string[]>(
  () => navigator?.languages || []
);

export function readBrowserLocale(localeCookieName: string): string[] {
  const candidates = [];
  // (1) Check cookie

  const cookieLocale = getCookieValue({
    cookieName: localeCookieName,
  });
  if (cookieLocale) candidates.push(cookieLocale);

  // (2) Check navigator locales
  candidates.push(...navigatorLocales.get());

  return candidates;
}
