import { intlCache } from '../cache/IntlCache';

/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 *
 * @param {string} code - The locale code to check.
 * @returns {string} 'rtl' if the language is right-to-left; otherwise 'ltr'.
 * @internal
 */
export function _getLocaleDirection(code: string): 'ltr' | 'rtl' {
  let languageCode: string | undefined;
  let scriptCode: string | undefined;

  // Extract via textInfo property
  try {
    const locale = intlCache.get('Locale', code);
    const textInfoDirection = extractDirectionWithTextInfo(locale);
    if (textInfoDirection) {
      return textInfoDirection;
    }
    languageCode = locale.language;
    scriptCode = locale.script;
  } catch {
    ({ languageCode, scriptCode } = extractLocaleParts(code));
  }

  // Handle RTL script or language
  if (scriptCode) {
    return RTL_SCRIPTS.has(scriptCode.toLowerCase()) ? 'rtl' : 'ltr';
  }
  if (languageCode) {
    return RTL_LANGUAGES.has(languageCode.toLowerCase()) ? 'rtl' : 'ltr';
  }

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
 * @param locale - Intl.Locale object.
 * @returns {'ltr' | 'rtl'} - The direction of the locale
 *
 * Intl.Locale.prototype.getTextInfo() / textInfo property incorporated in ES2024 Specification.
 * This is not supported by all browsers yet.
 * See: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getTextInfo#browser_compatibility}
 */
function extractDirectionWithTextInfo(locale: Intl.Locale) {
  const direction =
    'textInfo' in locale &&
    typeof locale.textInfo === 'object' &&
    locale.textInfo !== null &&
    'direction' in locale.textInfo
      ? locale.textInfo.direction
      : undefined;
  return direction === 'rtl' || direction === 'ltr' ? direction : undefined;
}

function extractLocaleParts(code: string): {
  languageCode?: string;
  scriptCode?: string;
} {
  const parts = code.replaceAll('_', '-').split('-');
  const languageCode = /^[a-z]{2,3}$/i.test(parts[0]) ? parts[0] : undefined;
  const scriptCode = parts.find((part) => /^[a-z]{4}$/i.test(part));
  return { languageCode, scriptCode };
}
