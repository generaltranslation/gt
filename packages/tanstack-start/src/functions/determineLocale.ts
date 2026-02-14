import { defaultLocaleCookieName } from 'gt-react/internal';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader, getCookie } from '@tanstack/react-start/server';
import { CustomMapping } from 'generaltranslation/types';
import { determineLocale as gtDetermineLocale } from 'generaltranslation';

type DetermineLocaleOptions = {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
};

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
}: DetermineLocaleOptions) {
  const candidates = [];

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

  // determine locale (falling back to default locale if no match is found)
  console.log('[determineLocale](server): candidates:', candidates);
  console.log('[determineLocale](server): locales:', locales);
  console.log('[determineLocale](server): customMapping:', customMapping);
  console.log('[determineLocale](server): defaultLocale:', defaultLocale);
  const result =
    gtDetermineLocale(candidates, locales, customMapping) || defaultLocale;
  console.log('[determineLocale](server):', result);
  return result;
}

/**
 * Determines the locale on the client.
 */
function determineLocaleClient({
  defaultLocale,
  locales,
  customMapping,
}: DetermineLocaleOptions) {
  const candidates = [];

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
    candidates.push(defaultLocale);
  }

  // determine locale (falling back to default locale if no match is found)
  const result =
    gtDetermineLocale(candidates, locales, customMapping) || defaultLocale;
  console.log('[determineLocale](client):', result);
  return result;
}
