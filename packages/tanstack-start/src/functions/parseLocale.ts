import { createIsomorphicFn } from '@tanstack/react-start';
import {
  getRequestHeader,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server';
import {
  getI18nConfig,
  getReadonlyConditionStore,
  isReadonlyConditionStoreInitialized,
} from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import type { LocaleResolverConfig } from 'gt-i18n/internal/types';
import { localeCookieOptions, resolveRequestLocale } from './requestConditions';

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
}: LocaleResolverConfig) {
  if (isReadonlyConditionStoreInitialized()) {
    return getReadonlyConditionStore().getLocale();
  }

  const i18nConfig = getI18nConfig();
  const localeCookieName = i18nConfig.getLocaleCookieName();
  const cookie = getCookie(localeCookieName);
  const locale = resolveRequestLocale({
    cookieLocale: cookie,
    acceptLanguage: getRequestHeader('accept-language'),
    config: { defaultLocale, locales, customMapping },
  });

  setCookie(localeCookieName, locale, localeCookieOptions);

  return locale;
}

function determineLocaleClient({
  defaultLocale,
  locales,
  customMapping,
}: LocaleResolverConfig) {
  const i18nConfig = getI18nConfig();
  const localeCookieName = i18nConfig.getLocaleCookieName();
  const candidates: string[] = [];

  const cookie = getCookieValue(document.cookie, localeCookieName);
  if (cookie) candidates.push(cookie);

  if (candidates.length === 0) {
    console.warn(
      'gt-tanstack-start(client): no locales could be determined for this request'
    );
  }

  return i18nConfig.resolveSupportedLocale(candidates, {
    defaultLocale,
    locales,
    customMapping,
  });
}
