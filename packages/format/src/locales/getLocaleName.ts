import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../settings/settings';
import { CustomMapping, getCustomProperty } from './customLocaleMapping';
import { _standardizeLocale } from './isValidLocale';
import { _resolveCanonicalLocale } from './resolveCanonicalLocale';

/**
 * Retrieves the display name(s) of locale code(s) using Intl.DisplayNames.
 *
 * @param {string} locale - A BCP-47 locale code.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The locale for display names.
 * @returns {string} The display name(s) corresponding to the code(s), or empty string(s) if invalid.
 * @internal
 */
export function _getLocaleName(
  locale: string,
  defaultLocale: string = libraryDefaultLocale,
  customMapping?: CustomMapping
): string {
  // Check for canonical locale
  const aliasedLocale = locale;
  locale = _resolveCanonicalLocale(locale, customMapping);

  defaultLocale ||= libraryDefaultLocale;
  try {
    const standardizedLocale = _standardizeLocale(locale);
    if (customMapping) {
      for (const l of [
        aliasedLocale,
        locale,
        standardizedLocale,
        intlCache.get('Locale', standardizedLocale).language,
      ]) {
        const customName = getCustomProperty(customMapping, l, 'name');
        if (customName) return customName;
      }
    }
    const displayNames = intlCache.get(
      'DisplayNames',
      [defaultLocale, standardizedLocale, libraryDefaultLocale], // default locale order
      { type: 'language' }
    );
    return displayNames.of(standardizedLocale) || '';
  } catch {
    // In case Intl.DisplayNames construction fails, return empty string(s)
    return '';
  }
}
