import { intlCache } from '../cache/IntlCache';

/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 *
 * @param {string} code - The locale code to check.
 * @returns {string} - 'rtl' if the language is right-to-left, otherwise 'ltr'.
 * @internal
 */
export function _getLocaleDirection(code: string): 'ltr' | 'rtl' {
  let script: string | undefined, language: string | undefined;
  try {
    const locale = intlCache.get('Locale', code);

    // Extract via textInfo property
    const textInfoDirection = extractDirectionWithTextInfo(locale);
    if (textInfoDirection) {
      return textInfoDirection;
    }

    // Extract via script and language properties
    script = getLikelyScript(locale);
    language = locale.language;
  } catch {
    // silent
  }

  // Fallback to simple heuristics
  script ||= extractScript(code);
  language ||= extractLanguage(code);

  // Handle RTL script or language
  if (isRtlScript(script)) return 'rtl';
  if (isRtlLanguage(language)) return 'rtl';

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
    locale.textInfo?.direction &&
    (locale.textInfo?.direction === 'rtl' ||
      locale.textInfo?.direction === 'ltr')
  ) {
    return locale.textInfo?.direction;
  }

  return undefined;
}

function extractLanguage(code: string): string | undefined {
  return code?.split(/[-_]/)[0]?.toLowerCase();
}

/**
 * Handles extracting direction via script property
 * @param code - The locale code to extract the script from
 * @returns {string | undefined} - The script of the locale
 *
 * Script segment guaranteed to be 4 characters long.
 * Filter by letters to avoid variant: https://datatracker.ietf.org/doc/html/rfc5646#section-2.2.5
 */
function extractScript(code: string): string | undefined {
  return code
    ?.split(/[-_]/)
    .find((segment) => segment.length === 4 && /^[a-zA-Z]+$/.test(segment))
    ?.toLowerCase();
}

function getLikelyScript(locale: Intl.Locale): string | undefined {
  // Check for script property directly
  if (locale?.script) {
    return locale.script.toLowerCase();
  }

  // Check for script property via maximize()
  if (typeof locale?.maximize === 'function') {
    const maximized = locale.maximize();
    if (maximized?.script) {
      return maximized.script.toLowerCase();
    }
  }

  return undefined;
}

function isRtlScript(script: string | undefined): boolean {
  return script ? RTL_SCRIPTS.has(script.toLowerCase()) : false;
}

function isRtlLanguage(language: string | undefined): boolean {
  return language ? RTL_LANGUAGES.has(language.toLowerCase()) : false;
}
