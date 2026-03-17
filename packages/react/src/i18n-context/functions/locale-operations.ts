import { getBrowserI18nManager } from '../setup/singleton-operations';

/**
 * Returns the user's current locale.
 * @returns {string} The user's current locale.
 *
 * @example
 * const locale = getLocale();
 * console.log(locale); // 'en-US'
 */
export function getLocale() {
  const i18nManager = getBrowserI18nManager();
  return i18nManager.getLocale();
}

/**
 * Returns the locales that are supported by the application.
 * @returns {string[]} The locales that are supported by the application.
 *
 * @example
 * const locales = getLocales();
 * console.log(locales); // ['en-US', 'es-ES']
 */
export function getLocales() {
  const i18nManager = getBrowserI18nManager();
  return i18nManager.getLocales();
}

/**
 * Returns the user's current locales.
 * @returns {string[]} The user's current locales.
 *
 * @note This function causes a page reload
 *
 * @example
 * const locales = getLocales();
 * console.log(locales); // ['en-US', 'es-ES']
 */
export function setLocale(locale: string) {
  const i18nManager = getBrowserI18nManager();
  return i18nManager.setLocale(locale);
}

/**
 * Returns the user's current default locale.
 * @returns {string} The user's current default locale.
 *
 * @example
 * const defaultLocale = getDefaultLocale();
 * console.log(defaultLocale); // 'en-US'
 */
export function getDefaultLocale() {
  const i18nManager = getBrowserI18nManager();
  return i18nManager.getDefaultLocale();
}
