import { getCookieValue } from './cookies';
import { oncePerTask } from './oncePerTask';

const navigatorLocales = oncePerTask<readonly string[]>(
  () => navigator?.languages || []
);

/** The navigator's locales as this task reads them: one array until they are read again. */
export const getTaskNavigatorLocales = navigatorLocales.get;

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
