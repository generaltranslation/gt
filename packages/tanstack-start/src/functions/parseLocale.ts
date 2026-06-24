import { defaultLocaleCookieName } from 'gt-react';
import { createIsomorphicFn } from '@tanstack/react-start';
import {
  getRequestHeader,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server';
import { getI18nConfig } from 'gt-i18n/internal';
import type { I18nConfigParams } from 'gt-i18n/internal/types';

export const determineLocale = createIsomorphicFn()
  .server(determineLocaleServer)
  .client(determineLocaleClient);

/**
 * Resolve the user's locale for the current TanStack Start request or browser.
 */
export function parseLocale(): string {
  const i18nConfig = getI18nConfig();
  return determineLocale({
    defaultLocale: i18nConfig.getDefaultLocale(),
    locales: i18nConfig.getLocales(),
    customMapping: i18nConfig.getCustomMapping(),
  });
}

function determineLocaleServer({
  defaultLocale,
  locales,
  customMapping,
}: I18nConfigParams) {
  const candidates: string[] = [];

  const cookie = getCookie(defaultLocaleCookieName);
  if (cookie) candidates.push(cookie);

  const headers =
    getRequestHeader('accept-language')
      ?.split(',')
      .map((item) => item.split(';')?.[0].trim()) || [];
  candidates.push(...headers);

  if (candidates.length === 0) {
    console.warn(
      'gt-tanstack-start(server): no locales could be determined for this request'
    );
  }

  const locale = getI18nConfig().resolveSupportedLocale(candidates, {
    defaultLocale,
    locales,
    customMapping,
  });

  setCookie(defaultLocaleCookieName, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return locale;
}

function determineLocaleClient({
  defaultLocale,
  locales,
  customMapping,
}: I18nConfigParams) {
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

  return getI18nConfig().resolveSupportedLocale(candidates, {
    defaultLocale,
    locales,
    customMapping,
  });
}
