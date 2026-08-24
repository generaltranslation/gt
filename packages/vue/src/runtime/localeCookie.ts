import {
  getBrowserCookieValue,
  setBrowserCookieValue,
} from 'gt-i18n/internal/cookies';

type CreateCookieBackedLocaleOptions = {
  defaultLocale: string;
  locale?: string;
  localeCookieName: string;
  resolveLocale?: (locale: string) => string;
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
  resolveLocale = identityLocale,
}: CreateCookieBackedLocaleOptions): CookieBackedLocale {
  const cookieLocale = getBrowserCookieValue(localeCookieName);
  const resolvedLocale = resolveLocale(
    explicitLocale ?? (cookieLocale || defaultLocale)
  );
  const browserFallbackLocale = resolveLocale(explicitLocale ?? defaultLocale);
  let serverLocale = resolvedLocale;

  // Match React's hydration contract: an explicit server locale wins over a
  // stale browser cookie and becomes the persisted client value.
  setBrowserCookieValue(localeCookieName, resolvedLocale);

  return {
    getLocale() {
      if (typeof document !== 'undefined') {
        return resolveLocale(
          getBrowserCookieValue(localeCookieName) || browserFallbackLocale
        );
      }
      return serverLocale;
    },
    setLocale(nextLocale) {
      const resolvedNextLocale = resolveLocale(nextLocale);
      serverLocale = resolvedNextLocale;
      setBrowserCookieValue(localeCookieName, resolvedNextLocale);
    },
  };
}

/** Preserves unrestricted locale behavior when no resolver is configured. */
function identityLocale(locale: string): string {
  return locale;
}
