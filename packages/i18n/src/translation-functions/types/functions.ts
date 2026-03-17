import {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from './options';

/**
 * Synchronous resolution function type
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} options - The options for the translation.
 * @returns {string} The translated message.
 *
 * @important This is base type for user API
 *
 * TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
 */
export type SyncResolutionFunction = (
  message: string,
  options?: InlineTranslationOptions
) => string;

/**
 * Type for the gt() function
 * @param {string} message - The message to translate
 * @param {InlineTranslationOptions} options - The options for the translation
 * @returns {string} The translated message
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type GTFunctionType = SyncResolutionFunction;

/**
 * Type for the m() function
 * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
 * @param {InlineTranslationOptions} options - The options to interpolate.
 * @returns {string | null | undefined} The decoded and interpolated message.
 * TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type MFunctionType = <T extends string | null | undefined>(
  encodedMsg: T,
  // TODO: this needs to become a InlineTranslationOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>
) => T extends string ? string : T;

/**
 * Type for the t() function
 * @param {string} id - The id of the translation to translate.
 * @param {DictionaryTranslationOptions} options - The options for the translation.
 * @returns {string} The translated message.
 * TODO: next major version, remove the "...type" suffix, it's redundant
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
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type TxFunctionType = (
  message: string,
  options?: RuntimeTranslationOptions
) => Promise<string>;
