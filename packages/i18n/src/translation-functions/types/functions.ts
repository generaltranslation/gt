import type { JsxChildren } from '@generaltranslation/format/types';
import {
  GTTranslationOptions,
  JsxTranslationOptions,
  TranslationVariables,
} from './options';

export type DictionaryObjectTranslation =
  | string
  | {
      [key: string]: DictionaryObjectTranslation;
    };

/**
 * Synchronous resolution function type
 * @param {string} message - The message to translate.
 * @param {GTTranslationOptions} options - The options for the translation.
 * @returns {string | undefined} The translated message or undefined if the message is not found.
 *
 * @important This is base type for user API
 *
 * TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: GTTranslationOptions) => T extends string ? string : T;
 */
export type SyncResolutionFunction = (
  message: string,
  options?: GTTranslationOptions
) => string | undefined;

/**
 * Synchronous resolution function type
 * @param {string} message - The message to translate.
 * @param {GTTranslationOptions} options - The options for the translation.
 * @returns {string} The translated message.
 *
 * @important This is base type for user API
 *
 * TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: GTTranslationOptions) => T extends string ? string : T;
 */
export type SyncResolutionFunctionWithFallback = (
  message: string,
  options?: GTTranslationOptions
) => string;

/**
 * Type for the gt() function
 * @param {string} message - The message to translate
 * @param {GTTranslationOptions} options - The options for the translation
 * @returns {string} The translated message
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type GTFunctionType = SyncResolutionFunctionWithFallback;

/**
 * Type for the m() function
 * @param {string | null | undefined} encodedMsg - The encoded message to decode and interpolate.
 * @param {GTTranslationOptions} options - The options to interpolate.
 * @returns {string | null | undefined} The decoded and interpolated message.
 * TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: GTTranslationOptions) => T extends string ? string : T;
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type MFunctionType = <T extends string | null | undefined>(
  encodedMsg: T,
  options?: GTTranslationOptions
) => T extends string ? string : T;

/**
 * Type for the t() function
 * @param {string} id - The id of the translation to translate.
 * @param {TranslationVariables} options - The variables for interpolation.
 * @returns {string} The translated message.
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type TFunctionType = ((
  id: string,
  options?: TranslationVariables
) => string) & {
  obj: (id: string) => DictionaryObjectTranslation;
};

/**
 * Type for the resolveJsx() function
 * @param {JsxChildren} children - The children to resolve the translation for.
 * @param {JsxTranslationOptions} options - The options for the translation.
 * @returns {JsxChildren} The resolved translation.
 */
export type ResolveJsxTranslationFunction = (
  locale: string,
  children: JsxChildren,
  options?: JsxTranslationOptions
) => JsxChildren | undefined;
