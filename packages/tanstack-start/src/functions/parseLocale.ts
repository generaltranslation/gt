import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import {
  getI18nConfig,
  getReadonlyConditionStore,
} from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import type { LocaleResolverConfig } from 'gt-i18n/internal/types';
import {
  getConditionStore,
  isConditionStoreInitialized,
} from '../condition-store/singleton';
import type { InitializeGTParams } from '../types/InitializeGTParams';
import { getLocaleFromPath } from './localeRouting';
import { resolveRequestConditions } from './requestConditions';

export const determineLocale = createIsomorphicFn()
  .server(determineLocaleServer)
  .client(() => getReadonlyConditionStore().getLocale());

/**
 * Resolve the user's locale for the current TanStack Start request or browser.
 *
 * @deprecated Use `getLocale()` instead. Once GT is initialized, this returns
 * the same request locale; it is retained as a fallback for server setups
 * that have not initialized GT, where it resolves the locale from the
 * request's cookie and Accept-Language header.
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
  // The store resolves each request once, with or without gtMiddleware, so
  // this matches getLocale() and writes no conflicting locale cookie.
  if (isConditionStoreInitialized()) {
    return getConditionStore().getLocale();
  }

  return resolveRequestConditions(getRequest(), {
    defaultLocale,
    locales,
    customMapping,
  }).locale;
}

/**
 * Read the server-synchronized locale cookie during client initialization.
 * With localeRouting, a pathname locale wins: SPA roots and visits with a
 * stale cookie have no server state to correct it.
 */
export function determineLocaleClient({
  defaultLocale,
  locales,
  customMapping,
  localeRouting,
}: LocaleResolverConfig & Pick<InitializeGTParams, 'localeRouting'>): string {
  const i18nConfig = getI18nConfig();
  const localeCookieName = i18nConfig.getLocaleCookieName();
  const candidates: string[] = [];

  if (localeRouting) {
    const pathLocale = getLocaleFromPath(window.location.pathname);
    if (pathLocale) candidates.push(pathLocale);
  }

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
