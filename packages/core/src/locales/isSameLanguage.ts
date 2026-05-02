import { intlCache } from '../cache/IntlCache';

/**
 * @internal
 */
export default function _isSameLanguage(
  ...locales: (string | string[])[]
): boolean {
  try {
    const flattenedCodes = locales.flat();
    // Compare the language subtag for each locale code.
    const languages = flattenedCodes.map(
      (locale) => intlCache.get('Locale', locale).language
    );
    return languages.every((language) => language === languages[0]);
  } catch (error) {
    console.error(error);
    return false;
  }
}
