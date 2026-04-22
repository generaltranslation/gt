import { getI18nManager } from '../async-i18n-manager/singleton-operations';

/**
 * A request object like interface
 * @interface RequestLike
 * @property {Record<string, string | string[] | undefined>} headers - The request headers
 */
interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Parse the Accept-Language header into an array of locales
 * @param header - The Accept-Language header
 * @returns An array of locales
 *
 * @example
 * const locales = parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8');
 * console.log(locales); // ['fr-FR', 'fr', 'en']
 */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((entry) => {
      const [locale, quality] = entry.trim().split(';');
      const qPart = quality?.split('=')[1];
      return {
        locale: locale.trim(),
        quality: qPart !== undefined ? parseFloat(qPart) || 1 : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.locale);
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
  const i18nManager = getI18nManager();
  const defaultLocale = i18nManager.getDefaultLocale();
  const gtInstance = i18nManager.getGTClass();

  // Get the accept-language header
  const acceptLanguage = request.headers['accept-language'];
  const headerValue = Array.isArray(acceptLanguage)
    ? acceptLanguage[0]
    : acceptLanguage;
  if (!headerValue) return defaultLocale;

  // Parse the accept-language header
  const preferredLocales = parseAcceptLanguage(headerValue);
  return gtInstance.determineLocale(preferredLocales) || defaultLocale;
}
