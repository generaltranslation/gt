import { getI18nManager } from 'gt-i18n/internal';
import { determineLocale } from './determineLocale';

/**
 * Returns the user's current locale.
 * @returns {string} The user's current locale.
 *
 * TODO: user provided override
 */
export function getLocale() {
  const i18nManager = getI18nManager();
  return i18nManager.getLocale();
}
