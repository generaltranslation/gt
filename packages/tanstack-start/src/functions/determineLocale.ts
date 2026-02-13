import { defaultLocaleCookieName } from 'gt-react/internal';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader, getCookie } from '@tanstack/react-start/server';
import { CustomMapping } from 'generaltranslation/types';

type DetermineLocaleOptions = {
  locale: string;
  locales: string[];
  customMapping?: CustomMapping;
};

type DetermineLocaleFunction = () => string;

/**
 * Determines the locale isomorphicly.
 *
 *
 * @internal - for exporting use client facing getLocale() instead, everywhere internally should use determineLocale()
 * TODO: move this file to a more intuitive location in this package when it becomes clear
 * TODO: unclear if this should be combined with client or not
 */
export const determineLocale = createIsomorphicFn()
  .server(determineLocaleServer)
  .client(determineLocaleClient);

/**
 * Determines the locale on the server.
 */
function determineLocaleServer() {
  const candidates = [];

  // (1) Check cookie
  const cookie = getCookie(defaultLocaleCookieName);
  if (cookie) candidates.push(cookie);

  // (2) Check headers
  const headers =
    getRequestHeader('accept-language')
      ?.split(',')
      .map((item) => item.split(';')?.[0].trim()) || [];
  if (headers) candidates.push(...headers);

  // (3) Fallback to default locale
  candidates.push('en');

  // TODO: validate and standardize

  const result = candidates.shift()!;
  console.log('[determineLocale](server):', result);

  return result;
}

/**
 * Determines the locale on the client.
 */
function determineLocaleClient() {
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

  // (3) Fallback to default locale
  candidates.push('en');

  // TODO: validate and standardize

  const result = candidates.shift()!;
  console.log('[determineLocale](client):', result);

  return result;
}
