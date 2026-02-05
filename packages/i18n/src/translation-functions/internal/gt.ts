import { gtFallback } from '../fallbacks/gtFallback';
import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../types';
import { InteralGtFunctionType } from './types';
/**
 * Registers a message at build time and resolves its translation at runtime.
 * @param {string} message - The message to translate
 * @param {InlineTranslationOptions} options - The options for the translation
 * @returns The translated message
 *
 * @example
 * // Simple translation without interpolation
 * const greeting = await gt('Hello, world!');
 *
 * @example
 * // Translation with interpolation
 * const welcome = await gt('Hello, {name}!', { name: 'Alice' });
 */
export const gt: InteralGtFunctionType = async (
  message: string,
  options: InlineTranslationOptions
) => {
  const i18nManager = getI18nManager();
  const translation = await i18nManager.getTranslation(message, options);
  if (translation) message = translation;
  return gtFallback(message, options);
};
