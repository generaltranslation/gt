import { intlCache } from '../cache/IntlCache';
import { _standardizeLocale } from './isValidLocale';

/**
 * Test two or more language codes to determine if they are exactly the same
 * e.g. "en-US" and "en" would be exactly the same.
 * "en-GB" and "en" would be exactly the same.
 * "en-GB" and "en-US" would be different.
 * @internal
 */
export function _isSameDialect(...locales: (string | string[])[]): boolean {
  try {
    // standardize codes
    const localeObjects = locales
      .flat()
      .map((locale) => intlCache.get('Locale', _standardizeLocale(locale)));
    const [firstLocale] = localeObjects;
    const regions = new Set(
      localeObjects.map(({ region }) => region).filter(Boolean)
    );
    const scripts = new Set(
      localeObjects.map(({ script }) => script).filter(Boolean)
    );

    return (
      localeObjects.every(
        ({ language }) => language === firstLocale?.language
      ) &&
      regions.size <= 1 &&
      scripts.size <= 1
    );
  } catch (error) {
    console.error(error);
    return false;
  }
}
