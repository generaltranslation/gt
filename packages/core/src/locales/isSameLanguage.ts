import { intlCache } from "src/cache/IntlCache";

/**
 * @internal
 */
export default function _isSameLanguage(
  ...locales: (string | string[])[]
): boolean {
  try {
    const flattenedCodes = locales.flat();
    // Get the language for each code
    const languages = flattenedCodes.map(
      (locale) => intlCache.get('Locale', locale).language
    );
    return languages.every((language) => language === languages[0]);
  } catch (error) {
    console.error(error);
    return false;
  }
}
