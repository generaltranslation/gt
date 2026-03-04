import { intlCache } from '../cache/IntlCache';
import _getLocaleProperties from './getLocaleProperties';

/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 *
 * @param {string} code - The locale code to check.
 * @returns {string} - 'rtl' if the language is right-to-left, otherwise 'ltr'.
 * @internal
 */
export function _getLocaleDirection(code: string): 'ltr' | 'rtl' {
  // Extract via textInfo property
  try {
    const locale = intlCache.get('Locale', code);
    const textInfoDirection = extractDirectionWithTextInfo(locale);
    if (textInfoDirection) {
      return textInfoDirection;
    }
  } catch {
    // silent
  }

  // Fallback to simple heuristics
  const { scriptCode, languageCode } = _getLocaleProperties(code);

  // Handle RTL script or language
  if (scriptCode) return isRtlScript(scriptCode) ? 'rtl' : 'ltr';
  if (languageCode) return isRtlLanguage(languageCode) ? 'rtl' : 'ltr';

  return 'ltr';
}

// ===== HELPER CONSTANTS ===== //

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

// ===== HELPER FUNCTIONS ===== //

/**
 * Handles extracting direction via textInfo property
 * @param Locale - Intl.Locale object
 * @returns {'ltr' | 'rtl'} - The direction of the locale
 *
 * Intl.Locale.prototype.getTextInfo() / textInfo property incorporated in ES2024 Specification.
 * This is not supported by all browsers yet.
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
