import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getCookieValue, parseAcceptLanguage } from 'gt-i18n/internal';

type RequestWithHeaders = Pick<Request, 'headers'>;

/**
 * Resolve the user's locale from a Web Request.
 *
 * The configured locale cookie takes precedence over the Accept-Language
 * header. If neither contains a supported locale, the configured default
 * locale is returned.
 *
 * This is intended for incoming server requests. A Request created in the
 * browser does not automatically include document cookies or Accept-Language.
 */
export function parseLocale(request: RequestWithHeaders): string {
  const i18nConfig = getI18nConfig();
  const candidates: string[] = [];
  const cookieLocale = getCookieValue(
    request.headers.get('cookie'),
    i18nConfig.getLocaleCookieName()
  );

  if (cookieLocale) {
    candidates.push(cookieLocale);
  }

  candidates.push(
    ...parseAcceptLanguage(request.headers.get('accept-language'))
  );

  return i18nConfig.resolveSupportedLocale(candidates);
}
