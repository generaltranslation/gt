import {
  Content,
  DataFormat,
  JsxChildren,
  StringFormat,
} from 'generaltranslation/types';
import {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  JsxTranslationOptions,
  RuntimeTranslationOptions,
} from './options';
import { Translation } from '../../i18n-manager/translations-manager/utils/types/translation-data';

/**
 * Synchronous resolution function type
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} options - The options for the translation.
 * @returns {string | undefined} The translated message or undefined if the message is not found.
 *
 * @important This is base type for user API
 *
 * TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
 */
export type SyncResolutionFunction = (
  message: string,
  options?: InlineTranslationOptions
) => string | undefined;

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
export type SyncResolutionFunctionWithFallback = (
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
export type GTFunctionType = SyncResolutionFunctionWithFallback;

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
 * Type for the resolveJsxTranslation() function
 * @param {JsxChildren} children - The children to resolve the translation for.
 * @param {JsxTranslationOptions} options - The options for the translation.
 * @returns {JsxChildren} The resolved translation.
 */
export type ResolveJsxTranslationFunction = (
  children: JsxChildren,
  options?: JsxTranslationOptions
) => JsxChildren | undefined;
