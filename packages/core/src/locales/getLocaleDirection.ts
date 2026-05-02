import { intlCache } from '../cache/IntlCache';
import _getLocaleProperties from './getLocaleProperties';

/**
 * Gets the text direction for a given locale code using Intl.Locale when available.
 *
 * @param {string} code - The locale code to check.
 * @returns {string} 'rtl' if the language is right-to-left; otherwise 'ltr'.
 * @internal
 */
export function _getLocaleDirection(code: string): 'ltr' | 'rtl' {
  // Prefer the Intl.Locale textInfo property when it is available.
  try {
    const locale = intlCache.get('Locale', code);
    const textInfoDirection = extractDirectionWithTextInfo(locale);
    if (textInfoDirection) {
      return textInfoDirection;
    }
  } catch {
    // Fall back to heuristics if Intl.Locale cannot parse the code.
  }

  // Fall back to script and language heuristics.
  const { scriptCode, languageCode } = _getLocaleProperties(code);

  if (scriptCode) return isRtlScript(scriptCode) ? 'rtl' : 'ltr';
  if (languageCode) return isRtlLanguage(languageCode) ? 'rtl' : 'ltr';

  return 'ltr';
}

const RTL_SCRIPTS = new Set([
  'arab',
  'adlm',
  'hebr',
  'nkoo',
  'rohg',
  'samr',
  'syrc',
  'thaa',
  'yezi',
]);

const RTL_LANGUAGES = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'iw',
  'ku',
  'lrc',
  'nqo',
  'ps',
  'pnb',
  'sd',
  'syr',
  'ug',
  'ur',
  'yi',
]);

/**
 * Extracts direction from the Intl.Locale textInfo property.
 * @param locale - Intl.Locale object.
 * @returns The direction of the locale, if available.
 *
 * Intl.Locale.prototype.getTextInfo() / the textInfo property is incorporated in the ES2024 specification.
 * It is not supported by all browsers yet.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getTextInfo#browser_compatibility}
 */
function extractDirectionWithTextInfo(
  locale: Intl.Locale
): 'ltr' | 'rtl' | undefined {
  if (
    'textInfo' in locale &&
    typeof locale.textInfo === 'object' &&
    locale.textInfo !== null &&
    'direction' in locale.textInfo &&
    (locale.textInfo?.direction === 'rtl' ||
      locale.textInfo?.direction === 'ltr')
  ) {
    return locale.textInfo?.direction;
  }

  return undefined;
}

function isRtlScript(script: string | undefined): boolean {
  return script ? RTL_SCRIPTS.has(script.toLowerCase()) : false;
}

function isRtlLanguage(language: string | undefined): boolean {
  return language ? RTL_LANGUAGES.has(language.toLowerCase()) : false;
}
