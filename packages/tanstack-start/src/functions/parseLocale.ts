import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import {
  defaultLocaleCookieName,
  getI18nConfig,
} from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import type { LocaleResolverConfig } from 'gt-i18n/internal/types';
import {
  getConditionStore,
  isConditionStoreInitialized,
} from '../condition-store/singleton';
import { resolveRequestConditions } from './requestConditions';
import { getLocale } from './runtime';

export const determineLocale = createIsomorphicFn()
  .server(determineLocaleServer)
  .client(() => getLocale());

/**
 * Resolve the user's locale for the current TanStack Start request or browser.
 *
 * @deprecated Use `getLocale()` with `gtMiddleware` instead. This function is
 * retained as a fallback for server setups that have not initialized request
 * scope through the middleware.
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

/** Read the server-synchronized locale cookie during client initialization. */
export function determineLocaleClient({
  localeCookieName = defaultLocaleCookieName,
}: {
  localeCookieName?: string;
}): string | undefined {
  return getCookieValue(document.cookie, localeCookieName);
}
