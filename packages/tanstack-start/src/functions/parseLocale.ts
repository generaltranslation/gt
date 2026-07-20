import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import type { LocaleResolverConfig } from 'gt-i18n/internal/types';
import {
  getConditionStore,
  isConditionStoreInitialized,
} from '../condition-store/singleton';
import { resolveRequestConditions } from './requestConditions';

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
  if (isConditionStoreInitialized()) {
    const conditionStore = getConditionStore();
    if (conditionStore.hasActiveScope()) {
      return conditionStore.getLocale();
    }
  }

  return resolveRequestConditions(getRequest(), {
    defaultLocale,
    locales,
    customMapping,
  }).locale;
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
