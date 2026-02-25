import {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from './options';
import { gtFallback } from '../fallbacks/gtFallback';
import { mFallback } from '../fallbacks/mFallback';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import { InterpolatableMessage, RegisterableMessages } from '../types/message';

/**
 * Type for the gt() function
 * @param {string | string[]} message - The message to translate. See {@link InterpolatableMessageType} for more details.
 * @param {InlineTranslationOptions} options - The options for the translation
 * @returns {string | string[]} The translated message
 */
export type GTFunctionType = typeof gtFallback;

const testGT: GTFunctionType = (
  message: string,
  options?: InlineTranslationOptions
) => message;

/**
 * Type for the m() function
 * @param {string | string[] | null | undefined} message - The message to decode and interpolate. See {@link RegisterableMessages} for more details.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns {string | string[] | null | undefined} The decoded and interpolated message.
 */
export type MFunctionType = typeof mFallback;

/**
 * Type for the t() function
 * @param {string} id - The id of the translation to translate.
 * @param {DictionaryTranslationOptions} options - The options for the translation.
 * @returns {string} The translated message.
 */
export type TFunctionType = (
  id: string,
  options?: DictionaryTranslationOptions
) => string;

/**
 * Internal tx() function type
 * @param {string} message - The message to translate.
 * @param {RuntimeTranslationOptions} options - The options for the translation.
 * @returns {string} The translated message.
 */
export type TxFunctionType = (
  message: string,
  options?: RuntimeTranslationOptions
) => Promise<string>;
