import {
  DictionaryTranslationOptions,
  InlineResolveOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from '../types';

/**
 * Internal gt() function type
 * - Registration
 * - Resolution
 */
export type InteralGtFunctionType = (
  message: string,
  options: InlineTranslationOptions
) => Promise<string>;

/**
 * Internal m() function type
 * - Resolution
 */
export type InteralMFunctionType = (
  encodedMsg: string,
  options: InlineResolveOptions
) => Promise<string>;

/**
 * Internal t() function type
 * - Resolution
 */
export type InteralTFunctionType = (
  id: string,
  options: DictionaryTranslationOptions
) => Promise<string>;

/**
 * Internal tx() function type
 * - Runtime Translation
 */
export type InteralTxFunctionType = (
  message: string,
  options: RuntimeTranslationOptions
) => Promise<string>;
