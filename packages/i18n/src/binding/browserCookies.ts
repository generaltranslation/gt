// Browser cookie helpers and the GT cookie names, shared by the framework
// bindings (gt-react, gt-vue). All functions no-op outside the browser.
// gt-i18n compiles without DOM libs, so browser globals are reached through
// globalThis.

/**
 * Cookie name for tracking the user's selected locale.
 */
export const defaultLocaleCookieName = 'generaltranslation.locale';

/**
 * Cookie name for tracking the user's selected region.
 */
export const defaultRegionCookieName = 'generaltranslation.region';

/**
 * Cookie name for persisting the enableI18n feature flag.
 */
export const defaultEnableI18nCookieName = 'generaltranslation.enable-i18n';

/**
 * Cookie name for tracking the locale reset.
 * Used by gt-next middleware.
 */
export const defaultResetLocaleCookieName = 'generaltranslation.locale-reset';

type BrowserGlobals = {
  document?: { cookie: string };
  navigator?: { languages?: readonly string[] };
};

/**
 * Minimally parses a cookie value for a given cookie name.
 */
export function getCookieValue({
  cookieName,
}: {
  cookieName: string;
}): string | undefined {
  const { document } = globalThis as BrowserGlobals;
  if (document === undefined) return undefined;
  const rawCookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${cookieName}=`))
    ?.split('=')[1];
  return rawCookieValue;
}

/**
 * Sets a cookie value for a given cookie name.
 */
export function setCookieValue({
  cookieName,
  value,
}: {
  cookieName: string;
  value: string;
}): void {
  const { document } = globalThis as BrowserGlobals;
  if (document === undefined) return;
  document.cookie = `${cookieName}=${value};path=/`;
}

/**
 * Reads the browser's locale candidates: the locale cookie (if set) followed
 * by the navigator languages.
 */
export function readBrowserLocale(localeCookieName: string): string[] {
  const candidates: string[] = [];

  const cookieLocale = getCookieValue({ cookieName: localeCookieName });
  if (cookieLocale) candidates.push(cookieLocale);

  const { navigator } = globalThis as BrowserGlobals;
  if (navigator !== undefined) {
    candidates.push(...(navigator.languages || []));
  }

  return candidates;
}
