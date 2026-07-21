import { intlCache } from '../cache/IntlCache';
import { _standardizeLocale } from './isValidLocale';

// CLDR pseudo-locale regions (en-XA "Pseudo-Accents", ar-XB "Pseudo-Bidi").
// They exist to be rendered distinctly from their base language, so the
// unspecified-region leniency below must never match them.
const PSEUDO_REGIONS = new Set(['XA', 'XB']);

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
    const definedRegions = localeObjects
      .map(({ region }) => region)
      .filter((region): region is string => Boolean(region));
    const regions = new Set(definedRegions);
    const scripts = new Set(
      localeObjects.map(({ script }) => script).filter(Boolean)
    );
    // A pseudo-locale region only matches locales that carry the same region
    const pseudoRegionMismatch =
      definedRegions.some((region) => PSEUDO_REGIONS.has(region)) &&
      definedRegions.length !== localeObjects.length;

    return (
      localeObjects.every(
        ({ language }) => language === firstLocale?.language
      ) &&
      regions.size <= 1 &&
      !pseudoRegionMismatch &&
      scripts.size <= 1
    );
  } catch (error) {
    console.error(error);
    return false;
  }
}
