import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../internal';
import { getCustomProperty } from './customLocaleMapping';
import { LocaleProperties } from './getLocaleProperties';
import { _standardizeLocale } from './isValidLocale';

/**
 * Retrieves the display name(s) of language code(s) using Intl.DisplayNames.
 *
 * @param {string} locale - A BCP-47 locale code.
 * @param {string} [defaultLanguage=libraryDefaultLanguage] - The language for display names.
 * @returns {string} The display name(s) corresponding to the code(s), or empty string(s) if invalid.
 * @internal
 */
export function _getLocaleName(
  locale: string,
  defaultLanguage: string = libraryDefaultLocale,
  customMapping?: Record<string, string | LocaleProperties>
): string {
  defaultLanguage ||= libraryDefaultLocale;
  try {
    const standardizedLocale = _standardizeLocale(locale);
    if (customMapping) {
      for (const l of [
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
      [defaultLanguage, standardizedLocale, libraryDefaultLocale], // default language order
      { type: 'language' }
    );
    return displayNames.of(standardizedLocale) || '';
  } catch {
    // In case Intl.DisplayNames construction fails, return empty string(s)
    return '';
  }
}
