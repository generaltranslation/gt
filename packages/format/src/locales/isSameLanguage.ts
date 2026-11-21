import { intlCache } from '../cache/IntlCache';

/**
 * Returns the language subtag of a locale, or undefined when the locale
 * cannot be parsed.
 * @internal
 */
export function _getLocaleLanguage(locale: string): string | undefined {
  try {
    return intlCache.get('Locale', locale).language;
  } catch {
    return undefined;
  }
}

/**
 * @internal
 */
export function _isSameLanguage(...locales: (string | string[])[]): boolean {
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

/**
 * Whether `locale` reads the language that `sourceLocale` content is written
 * in. Source content then formats in `locale`: en text keeps en-GB dates for
 * an en-GB reader. A locale that cannot be parsed is no match.
 */
export function isSourceLanguage(
  locale: string,
  sourceLocale: string
): boolean {
  if (locale === sourceLocale) return true;
  const language = _getLocaleLanguage(locale);
  return (
    language !== undefined && language === _getLocaleLanguage(sourceLocale)
  );
}
