import { t as internalT } from 'gt-i18n';
import { SyncResolutionFunction } from 'gt-i18n/types';

/**
 * NOTE: t() is the only function exported from the 'gt-react' entry point.
 * All other functions in i18n-context are exported from the 'gt-react/browser' entry point.
 */

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message.
 *
 * This is a BROWSER ONLY function.
 *
 * @example
 * const t('Hello, world!'); // Translates 'Hello, world!'
 *
 * @example
 * const t('Hello, {name}!', { name: 'John' }); // Translates 'Hello, John!'
 *
 * @example
 * const t('Hello, {name}!', { name: 'John' }, { locale: 'en' }); // Translates 'Hello, John!'
 *
 * @example
 * const t('Hello, {name}!', { name: 'John' }, { locale: 'fr' }); // Translates 'Hello, John!'
 */
export const t: SyncResolutionFunction = (message, options) => {
  // Enforce browser environment
  if (typeof document === 'undefined') {
    throw new Error('t() must be used in a browser environment');
  }
  return internalT(message, options);
};
