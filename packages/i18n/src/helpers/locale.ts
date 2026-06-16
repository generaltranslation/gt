import { getWritableConditionStore } from '../condition-store/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';

/**
 * Get the current locale
 * @returns The current locale
 *
 * @example
 * const locale = getLocale();
 * console.log(locale); // 'en-US'
 */
export function getLocale() {
  return getWritableConditionStore().getLocale();
}

/**
 * Get the current region
 * @returns The current region, or undefined if no region is set
 *
 * @example
 * const region = getRegion();
 * console.log(region); // 'US' or undefined
 */
export function getRegion() {
  return getWritableConditionStore().getRegion();
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
  return getI18nConfig().getLocales();
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
  return getI18nConfig().getDefaultLocale();
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
export function getLocaleProperties(locale = getLocale()) {
  return getI18nConfig().getLocaleProperties(locale);
}

/**
 * Get the GT class
 * @returns The GT class
 *
 * @example
 * const gtClass = getGTClass();
 * console.log(gtClass); // 'en-US'
 */
export function getGTClass(locale?: string) {
  return getI18nConfig().getGTClass(locale);
}
