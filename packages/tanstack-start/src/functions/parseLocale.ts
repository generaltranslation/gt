import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import type { LocaleResolverConfig } from 'gt-i18n/internal/types';
import type { InitializeGTParams } from '../types/InitializeGTParams';
import { getLocaleFromPath } from './localeRouting';

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
