import { getLocaleProperties } from '@generaltranslation/format';
import type { LocaleProperties } from '@generaltranslation/format/types';

/**
 * Locale properties for a locale as it is written in the user's `locales` config.
 *
 * `getLocaleProperties(locale).code` returns the *canonical* BCP-47 form of a
 * tag, so "fr-ca" becomes "fr-CA" and "ja-jp" becomes "ja-JP". That is correct
 * when talking to the API, but it is wrong for anything that names a file, a
 * directory, a URL segment, or a locale key on disk: those must use the locale
 * exactly as the user configured it, because that is the spelling every other
 * part of the CLI uses. `resolveLocaleFiles` substitutes `[locale]` verbatim,
 * the string form of `transform` substitutes `[locale]` verbatim, and
 * `localizeStaticUrls` splices the raw locale into URL paths. If placeholder
 * substitution canonicalizes while those do not, a project that configures a
 * non-canonical tag gets content written to one directory and links pointing
 * at another.
 *
 * Locales that are already canonical (the common case) are unaffected: for
 * those, `code` and the configured string are identical.
 *
 * Callers that genuinely want the canonical tag should use
 * `gt.resolveCanonicalLocale`, or one of the explicitly-named properties such
 * as `{minimizedCode}` / `{maximizedCode}` / `{regionCode}`.
 */
export function getConfiguredLocaleProperties(
  locale: string
): LocaleProperties {
  return { ...getLocaleProperties(locale), code: locale };
}

// helper function to replace locale placeholders in a string
// with the corresponding locale properties
// ex: {locale} -> will be replaced with the locale code
// ex: {localeName} -> will be replaced with the locale name
export function replaceLocalePlaceholders(
  string: string,
  localeProperties: LocaleProperties
): string {
  return string.replace(/\{(\w+)\}/g, (match, property) => {
    // Handle common aliases
    if (property === 'locale' || property === 'localeCode') {
      return localeProperties.code;
    }
    if (property === 'localeName') {
      return localeProperties.name;
    }
    if (property === 'localeNativeName') {
      return localeProperties.nativeName;
    }
    // Check if the property exists in localeProperties
    if (property in localeProperties) {
      return localeProperties[property as keyof typeof localeProperties];
    }
    // Return the original placeholder if property not found
    return match;
  });
}
