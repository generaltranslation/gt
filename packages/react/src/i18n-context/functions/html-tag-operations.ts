import { getBrowserI18nManager } from '../browser-i18n-manager/singleton-operations';

/**
 * Update the html tag lang property
 * @param {string} locale - The locale to update the html tag lang property to
 * @returns {void}
 *
 * @example
 * updateHtmlTagLang('en');
 */
export function updateHtmlTagLang(locale: string): void {
  const i18nManager = getBrowserI18nManager();
  i18nManager.updateHtmlTag({ lang: locale });
}

/**
 * Update the html tag dir property
 * @param {string} dir - The direction to update the html tag dir property to
 * @returns {void}
 *
 * @example
 * updateHtmlTagDir('ltr');
 */
export function updateHtmlTagDir(dir: 'ltr' | 'rtl'): void {
  const i18nManager = getBrowserI18nManager();
  i18nManager.updateHtmlTag({ dir });
}
