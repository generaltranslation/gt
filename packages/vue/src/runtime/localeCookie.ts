import {
  getBrowserCookieValue,
  setBrowserCookieValue,
} from 'gt-i18n/internal/cookies';

type CreateCookieBackedLocaleOptions = {
  defaultLocale: string;
  locale?: string;
  localeCookieName: string;
};

type CookieBackedLocale = {
  getLocale(): string;
  setLocale(locale: string): void;
};

/**
 * Creates a locale accessor backed by the browser locale cookie.
 *
 * An explicit locale is authoritative for SSR and hydration. Without one, a
 * browser cookie wins over the configured default. Closure values provide
 * request-local SSR state and the browser's explicit/default fallback;
 * browser reads always consult the current cookie first.
 *
 * @param options - Initial locale inputs and the cookie name to use.
 * @returns A cookie-backed browser accessor with an SSR fallback.
 */
export function createCookieBackedLocale({
  defaultLocale,
  locale: explicitLocale,
  localeCookieName,
}: CreateCookieBackedLocaleOptions): CookieBackedLocale {
  const cookieLocale = getBrowserCookieValue(localeCookieName);
  const resolvedLocale = explicitLocale ?? (cookieLocale || defaultLocale);
  const browserFallbackLocale = explicitLocale ?? defaultLocale;
  let serverLocale = resolvedLocale;

  // Match React's hydration contract: an explicit server locale wins over a
  // stale browser cookie and becomes the persisted client value.
  setBrowserCookieValue(localeCookieName, resolvedLocale);

  return {
    getLocale() {
      if (typeof document !== 'undefined') {
        return getBrowserCookieValue(localeCookieName) || browserFallbackLocale;
      }
      return serverLocale;
    },
    setLocale(nextLocale) {
      serverLocale = nextLocale;
      setBrowserCookieValue(localeCookieName, nextLocale);
    },
  };
}
