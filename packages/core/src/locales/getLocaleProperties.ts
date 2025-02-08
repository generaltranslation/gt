import { libraryDefaultLocale } from '../internal';
import _getLocale from './getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './isValidLocale';
import _getLocaleEmoji from './getLocaleEmoji';

type LocaleProperties = {
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
 * @internal
 */
export default function _getLocaleProperties(
  locale: string,
  defaultLocale: string = libraryDefaultLocale
): LocaleProperties {
  try {
    locale = _standardizeLocale(locale); // "de-AT"

    const localeObject = new Intl.Locale(locale);
    const languageCode = localeObject.language; // "de"
    const baseRegion = localeObject.region; // "AT"

    const maximizedLocale = new Intl.Locale(locale).maximize();
    const maximizedCode = maximizedLocale.toString(); // "de-Latn-AT"
    const regionCode = maximizedLocale.region || ''; // "AT"
    const scriptCode = maximizedLocale.script || ''; // "Latn"

    const minimizedLocale = new Intl.Locale(locale).minimize();
    const minimizedCode = minimizedLocale.toString(); // "de-AT"

    // Language names (default and native)

    const languageNames = new Intl.DisplayNames(
      [defaultLocale, locale, libraryDefaultLocale],
      { type: 'language' }
    );
    const nativeLanguageNames = new Intl.DisplayNames(
      [locale, defaultLocale, libraryDefaultLocale],
      { type: 'language' }
    );

    const name = languageNames.of(locale) || locale; // "Austrian German"
    const nativeName = nativeLanguageNames.of(locale) || locale; // "Österreichisches Deutsch"

    const maximizedName = languageNames.of(maximizedCode) || locale; // "Austrian German (Latin)"
    const nativeMaximizedName = nativeLanguageNames.of(maximizedCode) || locale; // "Österreichisches Deutsch (Lateinisch)"

    const minimizedName = languageNames.of(minimizedCode) || locale; // "Austrian German", but for "de-DE" would just be "German"
    const nativeMinimizedName = nativeLanguageNames.of(minimizedCode) || locale; // "Österreichisches Deutsch", but for "de-DE" would just be "Deutsch"

    const languageName = languageNames.of(languageCode) || locale; // "German"
    const nativeLanguageName = nativeLanguageNames.of(languageCode) || locale; // "Deutsch"

    const nameWithRegionCode = baseRegion
      ? `${languageName} (${baseRegion})`
      : languageName; // German (AT)
    const nativeNameWithRegionCode = baseRegion
      ? `${nativeLanguageName} (${baseRegion})`
      : nativeLanguageName; // "Deutsch (AT)"

    // Region names (default and native)

    const regionNames = new Intl.DisplayNames(
      [defaultLocale, locale, libraryDefaultLocale],
      { type: 'region' }
    );
    const nativeRegionNames = new Intl.DisplayNames(
      [locale, defaultLocale, libraryDefaultLocale],
      { type: 'region' }
    );

    const regionName = regionNames.of(regionCode) || ''; // "Austria"
    const nativeRegionName = nativeRegionNames.of(regionCode) || ''; // "Österreich"

    // Script names (default and native)

    const scriptNames = new Intl.DisplayNames(
      [defaultLocale, locale, libraryDefaultLocale],
      { type: 'script' }
    );
    const nativeScriptNames = new Intl.DisplayNames(
      [locale, defaultLocale, libraryDefaultLocale],
      { type: 'script' }
    );

    const scriptName = scriptNames.of(scriptCode) || ''; // "Latin"
    const nativeScriptName = nativeScriptNames.of(scriptCode) || ''; // "Lateinisch"

    // Emoji

    const emoji = _getLocaleEmoji(locale);

    return {
      code: locale,
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
    const code = locale || '';
    const codeParts = code?.split('-');
    const languageCode = codeParts?.[0] || code || '';
    const regionCode =
      codeParts.length > 2 ? codeParts?.[2] : codeParts?.[1] || '';
    const scriptCode = codeParts?.[3] || '';
    const nameWithRegionCode = languageCode
      ? regionCode
        ? `${languageCode} (${regionCode})`
        : languageCode
      : '';

    return {
      code,
      name: code,
      nativeName: code,
      maximizedCode: code,
      maximizedName: code,
      nativeMaximizedName: code,
      minimizedCode: code,
      minimizedName: code,
      nativeMinimizedName: code,
      languageCode,
      languageName: languageCode,
      nativeLanguageName: languageCode,
      regionCode,
      regionName: regionCode,
      nativeRegionName: regionCode,
      scriptCode,
      scriptName: scriptCode,
      nativeScriptName: scriptCode,
      nameWithRegionCode,
      nativeNameWithRegionCode: code,
      emoji: _getLocaleEmoji(code),
    };
  }
}
