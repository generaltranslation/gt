import { libraryDefaultLocale } from '../settings/settings';
import { defaultEmoji } from './getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import _getLocaleEmoji from './getLocaleEmoji';
import { intlCache } from '../cache/IntlCache';
import { CustomMapping, shouldUseCanonicalLocale } from './customLocaleMapping';

export type LocaleProperties = {
  /** ex. "de-AT" - Standardized locale code. */
  code: string;
  /** ex. "Austrian German" - Display name in the requested display locale. */
  name: string;
  /** ex. "Österreichisches Deutsch" - Display name in the locale's native language. */
  nativeName: string;

  /** ex. "de" - Language subtag. */
  languageCode: string;
  /** ex. "German" - Language name in the requested display locale. */
  languageName: string;
  /** ex. "Deutsch" - Language name in the locale's native language. */
  nativeLanguageName: string;

  /** ex. "German (AT)" - Display name with the explicit region code, without maximizing the locale. */
  nameWithRegionCode: string;
  /** ex. "Deutsch (AT)" - Native display name with the explicit region code, without maximizing the locale. */
  nativeNameWithRegionCode: string;

  /** ex. "AT" - Most likely region subtag after maximizing the locale. */
  regionCode: string;
  /** ex. "Austria" - Region name in the requested display locale. */
  regionName: string;
  /** ex. "Österreich" - Region name in the locale's native language. */
  nativeRegionName: string;

  /** ex. "Latn" - Most likely script subtag after maximizing the locale. */
  scriptCode: string;
  /** ex. "Latin" - Script name in the requested display locale. */
  scriptName: string;
  /** ex. "Lateinisch" - Script name in the locale's native language. */
  nativeScriptName: string;

  /** ex. "de-Latn-AT" - Maximized locale code. */
  maximizedCode: string;
  /** ex. "Austrian German (Latin)" - Maximized locale name. */
  maximizedName: string;
  /** ex. "Österreichisches Deutsch (Lateinisch)" - Native maximized locale name. */
  nativeMaximizedName: string;

  /** ex. "de-AT" or "de" for "de-DE" - Minimized locale code. */
  minimizedCode: string;
  /** ex. "Austrian German" - Minimized locale name. */
  minimizedName: string;
  /** ex. "Österreichisches Deutsch" - Native minimized locale name. */
  nativeMinimizedName: string;

  /** Locale emoji, with overrides for some linguistic and cultural identities. */
  emoji: string;
};

/**
 * Creates a set of custom locale properties from a custom mapping.
 *
 * @param lArray - An array of locale codes to search for in the custom mapping.
 * @param customMapping - Optional custom mapping of locale codes to names.
 * @returns A partial set of locale properties, or undefined if no custom mapping is provided.
 */
export function createCustomLocaleProperties(
  lArray: string[],
  customMapping?: CustomMapping
): Partial<LocaleProperties> | undefined {
  if (customMapping) {
    let merged: Partial<LocaleProperties> = {};
    for (const l of lArray) {
      const value = customMapping[l];
      if (value) {
        if (typeof value === 'string') {
          merged.name ||= value;
        } else if (value) {
          merged = { ...value, ...merged };
        }
      }
    }
    return merged;
  }
  return undefined;
}

/**
 * @internal
 */
export default function _getLocaleProperties(
  locale: string,
  defaultLocale: string = libraryDefaultLocale,
  customMapping?: CustomMapping
): LocaleProperties {
  // Resolve custom aliases to canonical locales before processing.
  const aliasedLocale = locale;
  if (customMapping && shouldUseCanonicalLocale(locale, customMapping)) {
    locale = (customMapping[locale] as { code: string }).code;
  }

  defaultLocale ||= libraryDefaultLocale;

  try {
    const standardizedLocale = _standardizeLocale(locale);

    const localeObject = intlCache.get('Locale', locale);
    const languageCode = localeObject.language;

    const customLocaleProperties = createCustomLocaleProperties(
      [aliasedLocale, locale, standardizedLocale, languageCode],
      customMapping
    );

    const baseRegion = localeObject.region;

    const maximizedLocale = localeObject.maximize();
    const maximizedCode = maximizedLocale.toString();
    const regionCode =
      localeObject.region ||
      customLocaleProperties?.regionCode ||
      maximizedLocale.region ||
      '';
    const scriptCode =
      localeObject.script ||
      customLocaleProperties?.scriptCode ||
      maximizedLocale.script ||
      '';

    const minimizedLocale = localeObject.minimize();
    const minimizedCode = minimizedLocale.toString();

    // Language names (default and native)

    const defaultLanguageOrder = [defaultLocale, locale, libraryDefaultLocale];
    const nativeLanguageOrder = [locale, defaultLocale, libraryDefaultLocale];

    const languageNames = intlCache.get('DisplayNames', defaultLanguageOrder, {
      type: 'language',
    });
    const nativeLanguageNames = intlCache.get(
      'DisplayNames',
      nativeLanguageOrder,
      { type: 'language' }
    );

    const customName = customLocaleProperties?.name;
    const customNativeName =
      customLocaleProperties?.nativeName || customLocaleProperties?.name;

    const name = customName || languageNames.of(locale) || locale;
    const nativeName =
      customNativeName || nativeLanguageNames.of(locale) || locale;

    const maximizedName =
      customLocaleProperties?.maximizedName ||
      customName ||
      languageNames.of(maximizedCode) ||
      locale;
    const nativeMaximizedName =
      customLocaleProperties?.nativeMaximizedName ||
      customNativeName ||
      nativeLanguageNames.of(maximizedCode) ||
      locale;

    const minimizedName =
      customLocaleProperties?.minimizedName ||
      customName ||
      languageNames.of(minimizedCode) ||
      locale;
    const nativeMinimizedName =
      customLocaleProperties?.nativeMinimizedName ||
      customNativeName ||
      nativeLanguageNames.of(minimizedCode) ||
      locale;

    const languageName =
      customLocaleProperties?.languageName ||
      customName ||
      languageNames.of(languageCode) ||
      locale;
    const nativeLanguageName =
      customLocaleProperties?.nativeLanguageName ||
      customNativeName ||
      nativeLanguageNames.of(languageCode) ||
      locale;

    const nameWithRegionCode =
      customLocaleProperties?.nameWithRegionCode || baseRegion
        ? `${languageName} (${baseRegion})`
        : name;
    const nativeNameWithRegionCode =
      customLocaleProperties?.nativeNameWithRegionCode ||
      (baseRegion ? `${nativeLanguageName} (${baseRegion})` : nativeName) ||
      nameWithRegionCode;

    // Region names (default and native)

    const regionNames = intlCache.get('DisplayNames', defaultLanguageOrder, {
      type: 'region',
    });
    const nativeRegionNames = intlCache.get(
      'DisplayNames',
      nativeLanguageOrder,
      { type: 'region' }
    );

    const regionName =
      customLocaleProperties?.regionName ||
      (regionCode ? regionNames.of(regionCode) : '') ||
      '';
    const nativeRegionName =
      customLocaleProperties?.nativeRegionName ||
      (regionCode ? nativeRegionNames.of(regionCode) : '') ||
      '';

    // Script names (default and native)

    const scriptNames = intlCache.get('DisplayNames', defaultLanguageOrder, {
      type: 'script',
    });
    const nativeScriptNames = intlCache.get(
      'DisplayNames',
      nativeLanguageOrder,
      { type: 'script' }
    );

    const scriptName =
      customLocaleProperties?.scriptName ||
      (scriptCode ? scriptNames.of(scriptCode) : '') ||
      '';
    const nativeScriptName =
      customLocaleProperties?.nativeScriptName ||
      (scriptCode ? nativeScriptNames.of(scriptCode) : '') ||
      '';

    // Emoji

    const emoji =
      customLocaleProperties?.emoji ||
      _getLocaleEmoji(standardizedLocale, customMapping);

    return {
      code: standardizedLocale,
      name,
      nativeName,
      maximizedCode,
      maximizedName,
      nativeMaximizedName,
      minimizedCode,
      minimizedName,
      nativeMinimizedName,
      languageCode,
      languageName,
      nativeLanguageName,
      nameWithRegionCode,
      nativeNameWithRegionCode,
      regionCode,
      regionName,
      nativeRegionName,
      scriptCode,
      scriptName,
      nativeScriptName,
      emoji,
    };
  } catch {
    let code = _isValidLocale(locale) ? _standardizeLocale(locale) : locale;
    const codeParts = code?.split('-');
    let languageCode = codeParts?.[0] || code || '';
    let regionCode =
      codeParts.length > 2 ? codeParts?.[2] : codeParts?.[1] || '';
    let scriptCode = codeParts?.[3] || '';

    const customLocaleProperties = createCustomLocaleProperties(
      [code, languageCode],
      customMapping
    );

    code = customLocaleProperties?.code || code;
    const name = customLocaleProperties?.name || code;
    const nativeName = customLocaleProperties?.nativeName || name;

    const maximizedCode = customLocaleProperties?.maximizedCode || code;
    const maximizedName = customLocaleProperties?.maximizedName || name;
    const nativeMaximizedName =
      customLocaleProperties?.nativeMaximizedName || nativeName;

    const minimizedCode = customLocaleProperties?.minimizedCode || code;
    const minimizedName = customLocaleProperties?.minimizedName || name;
    const nativeMinimizedName =
      customLocaleProperties?.nativeMinimizedName || nativeName;

    languageCode = customLocaleProperties?.languageCode || languageCode;
    const languageName = customLocaleProperties?.languageName || name;
    const nativeLanguageName =
      customLocaleProperties?.nativeLanguageName || nativeName;

    regionCode = customLocaleProperties?.regionCode || regionCode;
    const regionName = customLocaleProperties?.regionName || '';
    const nativeRegionName = customLocaleProperties?.nativeRegionName || '';

    scriptCode = customLocaleProperties?.scriptCode || scriptCode;
    const scriptName = customLocaleProperties?.scriptName || '';
    const nativeScriptName = customLocaleProperties?.nativeScriptName || '';

    const nameWithRegionCode =
      customLocaleProperties?.nameWithRegionCode ||
      (regionName ? `${languageName} (${regionName})` : name);
    const nativeNameWithRegionCode =
      customLocaleProperties?.nativeNameWithRegionCode ||
      (nativeRegionName
        ? `${nativeLanguageName} (${nativeRegionName})`
        : nativeName);

    const emoji = customLocaleProperties?.emoji || defaultEmoji;

    return {
      code,
      name,
      nativeName,
      maximizedCode,
      maximizedName,
      nativeMaximizedName,
      minimizedCode,
      minimizedName,
      nativeMinimizedName,
      languageCode,
      languageName,
      nativeLanguageName,
      nameWithRegionCode,
      nativeNameWithRegionCode,
      regionCode,
      regionName,
      nativeRegionName,
      scriptCode,
      scriptName,
      nativeScriptName,
      emoji,
    };
  }
}
