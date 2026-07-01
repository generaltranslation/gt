import { getI18nConfig, parseAcceptLanguage } from 'gt-i18n/internal';

/**
 * A request object like interface
 * @interface RequestLike
 * @property {Record<string, string | string[] | undefined>} headers - The request headers
 */
interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Resolve the preferred locale from the request Accept-Language header, fallback to the default locale if no match is found
 * @param request - The request object
 * @returns The preferred locale
 *
 * @example
 * const locale = getRequestLocale({ headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } });
 * console.log(locale); // 'fr'
 *
 * @example
 * app.get('/', (req, res) => {
 *   const locale = getRequestLocale(req);
 *   withGT(locale, () => {
 *     res.send(`Locale: ${locale}`);
 *   });
 * });
 */
export function getRequestLocale(request: RequestLike): string {
  // Setup
  const i18nConfig = getI18nConfig();

  // Get the accept-language header
  const acceptLanguage = request.headers['accept-language'];
  const headerValue = Array.isArray(acceptLanguage)
    ? acceptLanguage[0]
    : acceptLanguage;

  // Parse the accept-language header
  const preferredLocales = headerValue ? parseAcceptLanguage(headerValue) : [];
  return (
    i18nConfig.determineLocale(preferredLocales) ||
    i18nConfig.getDefaultLocale()
  );
}
