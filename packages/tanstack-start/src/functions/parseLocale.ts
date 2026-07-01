import { defaultLocaleCookieName } from 'gt-react';
import { createIsomorphicFn } from '@tanstack/react-start';
import {
  getRequestHeader,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server';
import { getI18nConfig, parseAcceptLanguage } from 'gt-i18n/internal';

export const determineLocale = createIsomorphicFn()
  .server(determineLocaleServer)
  .client(determineLocaleClient);

/**
 * Resolve the user's locale for the current TanStack Start request or browser.
 */
export function parseLocale(): string {
  return determineLocale();
}

// createIsomorphicFn is a build-time split (not an RPC), so the i18n config
// singleton is available in both branches. There is no need to thread its
// values through — resolveSupportedLocale() reads them off the singleton.
function determineLocaleServer() {
  const candidates: string[] = [];

  const cookie = getCookie(defaultLocaleCookieName);
  if (cookie) candidates.push(cookie);

  const acceptLanguage = getRequestHeader('accept-language');
  if (acceptLanguage) candidates.push(...parseAcceptLanguage(acceptLanguage));

  if (candidates.length === 0) {
    console.warn(
      'gt-tanstack-start(server): no locales could be determined for this request'
    );
  }

  const locale = getI18nConfig().resolveSupportedLocale(candidates);

  setCookie(defaultLocaleCookieName, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return locale;
}

function determineLocaleClient() {
  const candidates: string[] = [];

  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${defaultLocaleCookieName}=`))
    ?.slice(defaultLocaleCookieName.length + 1);
  if (cookie) candidates.push(cookie);

  if (candidates.length === 0) {
    console.warn(
      'gt-tanstack-start(client): no locales could be determined for this request'
    );
  }

  return getI18nConfig().resolveSupportedLocale(candidates);
}
