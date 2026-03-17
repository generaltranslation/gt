import { resolveTranslationSync } from 'gt-i18n/internal';
import { SyncResolutionFunction } from 'gt-i18n/types';
import { createTranslationFailedDueToBrowserEnvironmentWarning } from '../../../shared/messages';
import { gtFallback } from 'gt-i18n/internal';

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
 * t('Hello, world!'); // Translates 'Hello, world!'
 *
 * @example
 * t('Hello, {name}!', { name: 'John' }); // Translates 'Hello, John!'
 *
 */
export const t: SyncResolutionFunction = (message, options) => {
  // Enforce browser environment
  if (typeof window === 'undefined') {
    console.warn(
      createTranslationFailedDueToBrowserEnvironmentWarning(message)
    );
    return gtFallback(message, options);
  }
  return resolveTranslationSync(message, options);
};
