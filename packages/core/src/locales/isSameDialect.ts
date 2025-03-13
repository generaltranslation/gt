import { intlCache } from 'src/cache/IntlCache';
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
 * Test two or more language codes to determine if they are exactly the same
 * e.g. "en-US" and "en" would be exactly the same.
 * "en-GB" and "en" would be exactly the same.
 * "en-GB" and "en-US" would be different.
 * @internal
 */
export default function _isSameDialect(
  ...locales: (string | string[])[]
): boolean {
  try {
    // standardize codes
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
