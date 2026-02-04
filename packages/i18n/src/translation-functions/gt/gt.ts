import { gtFallback } from '../fallbacks/gtFallback';
import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../../types';
/**
 * The gt() function both registers and resolves a translation
 * @param message - The message to translate
 * @param options - The options for the translation
 * @param {string} [options.$context] - The context for the translation
 * @param {string} [options.$id] - The id for the translation
 * @param {number} [options.$maxChars] - The maximum number of characters to translate
 * @param {string} [options.$_hash] - The hash for the translation
 * @param {string} [options.$locale] - The locale for the translation
 * @returns The translated message
 *
 * TODO: comment and types
 */

async function gt(
  message: string,
  options: InlineTranslationOptions
): Promise<string> {
  const i18nManager = getI18nManager();
  const translation = await i18nManager.getTranslation(message, options);
  if (translation) message = translation;
  return gtFallback(message, options);
}

export { gt };
