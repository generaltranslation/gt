import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getCookieValue, parseAcceptLanguage } from 'gt-i18n/internal';
import { getLocaleFromPath } from '../../functions/localeRouting';
import type { InitializeGTParams } from '../../types/InitializeGTParams';

/**
 * Resolve the locale for a request without side effects: the path locale (with
 * `localeRouting`), then the locale cookie, then `Accept-Language`, else the
 * default locale. The locale resolution of the regular
 * `resolveRequestConditions()` (keep in sync), without writing the locale
 * cookie, so locale twin assets can be chosen for any request. It reports
 * nothing: the request's own resolution warns about a missing preference.
 */
export function resolveRequestLocale(
  request: Request,
  localeConfig: InitializeGTParams
): string {
  const i18nConfig = getI18nConfig();
  const localeCandidates: string[] = [];
  if (localeConfig.localeRouting) {
    const pathLocale = getLocaleFromPath(new URL(request.url).pathname);
    if (pathLocale) localeCandidates.push(pathLocale);
  }
  const cookieLocale = getCookieValue(
    request.headers.get('cookie'),
    i18nConfig.getLocaleCookieName()
  );
  if (cookieLocale) localeCandidates.push(cookieLocale);
  localeCandidates.push(
    ...parseAcceptLanguage(request.headers.get('accept-language'))
  );
  return i18nConfig.resolveSupportedLocale(localeCandidates, localeConfig);
}
