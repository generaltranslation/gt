import { getBrowserConditionStore } from '../browser-i18n-cache/singleton-operations';
import { createInvalidLocaleWarning } from '../../shared/messages';
import { determineSupportedLocale, getI18nCache } from 'gt-i18n/internal';

/**
 * Sets the user's current locale.
 *
 * @note This function causes a page reload
 *
 * @example
 * setLocale('es-ES');
 */
export function setLocale(locale: string) {
  const i18nCache = getI18nCache();
  const newLocale = determineSupportedLocale(locale, {
    defaultLocale: i18nCache.getDefaultLocale(),
    locales: i18nCache.getLocales(),
    customMapping: i18nCache.getCustomMapping(),
  });
  if (!newLocale) {
    console.warn(createInvalidLocaleWarning(locale));
    return;
  }

  getBrowserConditionStore().setLocale(newLocale);
  window.location.reload();
}

export { getDefaultLocale, getLocale, getLocales } from 'gt-i18n/internal';
