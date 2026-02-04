import { InlineTranslationOptions } from '../../types';

// TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;

/**
 * Type for the gt() function
 * @param {string} message - The message to translate
 * @param {InlineTranslationOptions} options - The options for the translation
 * @returns {string} The translated message
 */
export type GTFunctionType = (
  message: string,
  options?: InlineTranslationOptions
) => string;

// TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
