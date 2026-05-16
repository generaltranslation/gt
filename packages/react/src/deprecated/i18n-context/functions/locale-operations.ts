import { getBrowserConditionStore } from '../browser-i18n-manager/singleton-operations';
import { createInvalidLocaleWarning } from '../../shared/messages';
import { determineSupportedLocale, getI18nManager } from 'gt-i18n/internal';

/**
 * Sets the user's current locale.
 *
 * @note This function causes a page reload
 *
 * @example
 * setLocale('es-ES');
 */
export function setLocale(locale: string) {
  const i18nManager = getI18nManager();
  const newLocale = determineSupportedLocale(locale, {
    defaultLocale: i18nManager.getDefaultLocale(),
    locales: i18nManager.getLocales(),
    customMapping: i18nManager.getCustomMapping(),
  });
  if (!newLocale) {
    console.warn(createInvalidLocaleWarning(locale));
    return;
  }

  getBrowserConditionStore().setLocale(newLocale);
  window.location.reload();
}

export { getDefaultLocale, getLocale, getLocales } from 'gt-i18n/internal';
