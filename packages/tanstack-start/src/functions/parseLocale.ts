import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import type { LocaleResolverConfig } from 'gt-i18n/internal/types';

/**
 * Read the server-synchronized locale cookie during client initialization.
 * With localeRouting, the pathname locale wins: SPA roots and visits with a
 * stale cookie have no server state to correct it.
 */
export function determineLocaleClient(
  { defaultLocale, locales, customMapping }: LocaleResolverConfig,
  pathLocale?: string
): string {
  const i18nConfig = getI18nConfig();
  const localeCookieName = i18nConfig.getLocaleCookieName();
  const candidates: string[] = [];

  if (pathLocale) candidates.push(pathLocale);

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
