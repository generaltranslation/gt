import {
  getCurrentLocale,
  getI18nManager,
} from '../i18n-manager/singleton-operations';

/**
 * Get the current locale
 * @returns The current locale
 *
 * @example
 * const locale = getLocale();
 * console.log(locale); // 'en-US'
 */
export function getLocale() {
  return getCurrentLocale();
}

/**
 * Get the configured locales
 * @returns The configured locales
 *
 * @example
 * const locales = getLocales();
 * console.log(locales); // ['en-US', 'es-ES']
 */
export function getLocales() {
  const i18nManager = getI18nManager();
  return i18nManager.getLocales();
}

/**
 * Get the default locale
 * @returns The default locale
 *
 * @example
 * const defaultLocale = getDefaultLocale();
 * console.log(defaultLocale); // 'en-US'
 */
export function getDefaultLocale() {
  const i18nManager = getI18nManager();
  return i18nManager.getDefaultLocale();
}

/**
 * Get the locale properties
 * @param {string} [locale] - The locale to get the properties for. When not provided, uses the current locale.
 * @returns The locale properties
 *
 * @example
 * const localeProperties = getLocaleProperties();
 *
 * @example
 * const localeProperties = getLocaleProperties('en-US');
 */
export function getLocaleProperties(locale = getCurrentLocale()) {
  const i18nManager = getI18nManager();
  const gtInstance = i18nManager.getGTClass();
  return gtInstance.getLocaleProperties(locale);
}
