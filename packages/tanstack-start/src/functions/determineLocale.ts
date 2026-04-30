import { defaultLocaleCookieName } from 'gt-react/internal';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader, getCookie } from '@tanstack/react-start/server';
import { resolveSupportedLocale } from 'gt-i18n/internal';
import type { ConditionStoreConfig } from 'gt-i18n/internal/types';

/**
 * Determines the locale isomorphicly.
 *
 * @internal - for exporting use client facing getLocale() instead, everywhere internally should use determineLocale()
 */
export const determineLocale = createIsomorphicFn()
  .server(determineLocaleServer)
  .client(determineLocaleClient);

/**
 * Determines the locale on the server.
 * Really this is only used on the client side when root loader is triggered
 */
function determineLocaleServer({
  defaultLocale,
  locales,
  customMapping,
}: ConditionStoreConfig) {
  const candidates: string[] = [];

  // (1) Check cookie
  const cookie = getCookie(defaultLocaleCookieName);
  if (cookie) candidates.push(cookie);

  // (2) Check headers
  if (process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false') {
    const headers =
      getRequestHeader('accept-language')
        ?.split(',')
        .map((item) => item.split(';')?.[0].trim()) || [];
    if (headers) candidates.push(...headers);
  }

  // Warn if no locales could be determined
  if (
    candidates.length === 0 &&
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false'
  ) {
    console.warn(
      'gt-tanstack-start(server): no locales could be determined for this request'
    );
  }

  return resolveSupportedLocale(candidates, {
    defaultLocale,
    locales,
    customMapping,
  });
}

/**
 * Determines the locale on the client.
 */
function determineLocaleClient({
  defaultLocale,
  locales,
  customMapping,
}: ConditionStoreConfig) {
  const candidates: string[] = [];

  // (1) Check cookie
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${defaultLocaleCookieName}=`))
    ?.split('=')[1];
  if (cookie) candidates.push(cookie);

  // (2) Check browser locale
  const browserLocale = navigator.language;
  if (browserLocale) candidates.push(browserLocale);

  if (candidates.length === 0) {
    console.warn(
      'gt-tanstack-start(client): no locales could be determined for this request'
    );
  }

  return resolveSupportedLocale(candidates, {
    defaultLocale,
    locales,
    customMapping,
  });
}
