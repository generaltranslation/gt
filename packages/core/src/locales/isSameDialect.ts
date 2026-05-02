import { intlCache } from '../cache/IntlCache';
import { _standardizeLocale } from './isValidLocale';

function checkTwoLocalesAreSameDialect(codeA: string, codeB: string) {
  const {
    language: languageA,
    region: regionA,
    script: scriptA,
  } = intlCache.get('Locale', codeA);
  const {
    language: languageB,
    region: regionB,
    script: scriptB,
  } = intlCache.get('Locale', codeB);
  if (languageA !== languageB) return false;
  if (regionA && regionB && regionA !== regionB) return false;
  if (scriptA && scriptB && scriptA !== scriptB) return false;
  return true;
}

/**
 * Tests whether two or more locale codes describe the same dialect.
 * Locale pairs are compatible when their languages match and any shared
 * region or script subtags are equal.
 *
 * For example, "en-US" matches "en", "en-GB" matches "en",
 * and "en-GB" does not match "en-US".
 * @internal
 */
export default function _isSameDialect(
  ...locales: (string | string[])[]
): boolean {
  try {
    // Standardize locale codes before comparing subtags.
    const flattenedCodes = locales.flat().map(_standardizeLocale);

    for (let i = 0; i < flattenedCodes.length; i++) {
      for (let j = i + 1; j < flattenedCodes.length; j++) {
        if (
          !checkTwoLocalesAreSameDialect(flattenedCodes[i], flattenedCodes[j])
        )
          return false;
      }
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
