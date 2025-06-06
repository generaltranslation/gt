import { libraryDefaultLocale } from '../internal';
import _getLocale, { defaultEmoji } from './getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import _getLocaleEmoji from './getLocaleEmoji';
import { intlCache } from 'src/cache/IntlCache';
import { CustomMapping } from './customLocaleMapping';

export type LocaleProperties = {
  // assume code = "de-AT", defaultLocale = "en-US"

  code: string; // "de-AT"
  name: string; // "Austrian German"
  nativeName: string; // "Österreichisches Deutsch"

  languageCode: string; // "de"
  languageName: string; // "German"
  nativeLanguageName: string; // "Deutsch"

  // note that maximize() is NOT called here!

  nameWithRegionCode: string; // "German (AT)"
  nativeNameWithRegionCode: string; // "Deutsch (AT)"

  // for most likely script and region, maximize() is called

  regionCode: string; // "AT"
  regionName: string; // "Austria"
  nativeRegionName: string; // Österreich

  scriptCode: string; // "Latn"
  scriptName: string; // "Latin"
  nativeScriptName: string; // "Lateinisch"

  maximizedCode: string; // "de-Latn-AT"
  maximizedName: string; // "Austrian German (Latin)"
  nativeMaximizedName: string; // Österreichisches Deutsch (Lateinisch)

  minimizedCode: string; // "de-AT", but for "de-DE" it would just be "de"
  minimizedName: string; // ""Austrian German";
  nativeMinimizedName: string; // "Österreichisches Deutsch"

  // Emoji depending on region code
  // In order not to accidentally spark international conflict, some emojis are hard-coded
  emoji: string;
};

/**
 * Creates a set of custom locale properties from a custom mapping.
 *
 * @param lArray - An array of locale codes to search for in the custom mapping.
 * @param customMapping - Optional custom mapping of locale codes to names.
 * @returns A partial set of locale properties, or undefined if no custom mapping is provided.
 */
function createCustomLocaleProperties(
  lArray: string[],
  customMapping?: CustomMapping
): Partial<LocaleProperties> | undefined {
  if (customMapping) {
    const merged: Partial<LocaleProperties> = {};
    for (const l of lArray) {
      const value = customMapping[l];
      if (typeof value === 'string') {
        merged.name = value;
      } else if (value) {
        Object.assign(merged, value);
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
  defaultLocale ||= libraryDefaultLocale;

  try {
    const standardizedLocale = _standardizeLocale(locale); // "de-AT"

    const localeObject = intlCache.get('Locale', locale);
    const languageCode = localeObject.language; // "de"

    const customLocaleProperties = createCustomLocaleProperties(
      [locale, standardizedLocale, languageCode],
      customMapping
    );

    const baseRegion = localeObject.region; // "AT"

    const maximizedLocale = localeObject.maximize();
    const maximizedCode = maximizedLocale.toString(); // "de-Latn-AT"
    const regionCode =
      localeObject.region ||
      customLocaleProperties?.regionCode ||
      maximizedLocale.region ||
      ''; // "AT"
    const scriptCode =
      localeObject.script ||
      customLocaleProperties?.scriptCode ||
      maximizedLocale.script ||
      ''; // "Latn"

    const minimizedLocale = localeObject.minimize();
    const minimizedCode = minimizedLocale.toString(); // "de-AT"

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

    const name = customName || languageNames.of(locale) || locale; // "Austrian German"
    const nativeName =
      customNativeName || nativeLanguageNames.of(locale) || locale; // "Österreichisches Deutsch"

    const maximizedName =
      customLocaleProperties?.maximizedName ||
      customName ||
      languageNames.of(maximizedCode) ||
      locale; // "Austrian German (Latin)"
    const nativeMaximizedName =
      customLocaleProperties?.nativeMaximizedName ||
      customNativeName ||
      nativeLanguageNames.of(maximizedCode) ||
      locale; // "Österreichisches Deutsch (Lateinisch)"

    const minimizedName =
      customLocaleProperties?.minimizedName ||
      customName ||
      languageNames.of(minimizedCode) ||
      locale; // "Austrian German", but for "de-DE" would just be "German"
    const nativeMinimizedName =
      customLocaleProperties?.nativeMinimizedName ||
      customNativeName ||
      nativeLanguageNames.of(minimizedCode) ||
      locale; // "Österreichisches Deutsch", but for "de-DE" would just be "Deutsch"

    const languageName =
      customLocaleProperties?.languageName ||
      customName ||
      languageNames.of(languageCode) ||
      locale; // "German"
    const nativeLanguageName =
      customLocaleProperties?.nativeLanguageName ||
      customNativeName ||
      nativeLanguageNames.of(languageCode) ||
      locale; // "Deutsch"

    const nameWithRegionCode = baseRegion
      ? `${languageName} (${baseRegion})`
      : languageName; // German (AT)
    const nativeNameWithRegionCode =
      (baseRegion
        ? `${nativeLanguageName} (${baseRegion})`
        : nativeLanguageName) || nameWithRegionCode; // "Deutsch (AT)"

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
      ''; // "Austria"
    const nativeRegionName =
      customLocaleProperties?.nativeRegionName ||
      (regionCode ? nativeRegionNames.of(regionCode) : '') ||
      ''; // "Österreich"

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
      ''; // "Latin"
    const nativeScriptName =
      customLocaleProperties?.nativeScriptName ||
      (scriptCode ? nativeScriptNames.of(scriptCode) : '') ||
      ''; // "Lateinisch"

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
  } catch (error) {
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
      (regionName ? `${name} (${regionName})` : name);
    const nativeNameWithRegionCode =
      customLocaleProperties?.nativeNameWithRegionCode ||
      (nativeRegionName ? `${nativeName} (${nativeRegionName})` : nativeName);

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
