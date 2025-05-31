import { intlCache } from '../cache/IntlCache';

/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 *
 * @param {string} code - The locale code to check.
 * @returns {string} - 'rtl' if the language is right-to-left, otherwise 'ltr'.
 * @internal
 */
export function _getLocaleDirection(code: string): 'ltr' | 'rtl' {
  try {
    const locale = intlCache.get('Locale', code);
    // Return 'rtl' if the text direction of the language is right-to-left, otherwise 'ltr'
    return (locale as any)?.textInfo?.direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    // If the code is invalid or causes an error, fallback to 'ltr'
    return 'ltr';
  }
}
