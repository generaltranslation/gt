import type {
  TranslationMetadata,
  TranslationVariables,
} from '../translation-functions/types/options';

/**
 * Valid types for messages that can be registered.
 * msg('Hello, World!')
 * msg(['Hello, World!', 'Welcome, {user}!'])
 */
export type RegisterableMessages = string | string[] | readonly string[];

/**
 * User-provided options accepted by t().
 *
 * interp vars + $context, $id, $format, $locale, $_hash, $maxChars
 */
export type GTTranslationOptions = TranslationVariables &
  Pick<
    TranslationMetadata,
    | '$context'
    | '$id'
    | '$format'
    | '$locale'
    | '$_hash'
    | '$maxChars'
    | '$requiresReview'
  >;

/**
 * Options for string registration
 * Used by the msg() function
 */
export type EncodedTranslationOptions = GTTranslationOptions & {
  $_hash: string;
  $_source: string;
};

/**
 * Type for the t() function returned by useGT() and getGT()
 * @param {string} message - The message to translate
 * @param {GTTranslationOptions} options - The options for the translation
 * @returns {string} The translated message
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type GTFunctionType = (
  message: string,
  options?: GTTranslationOptions
) => string;

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
