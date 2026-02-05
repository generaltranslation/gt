/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { DictionaryTranslationOptions } from '../types';
import { InteralTFunctionType } from './types';

/**
 * Dictionary resolution
 * @param {string} id - The id of the translation to translate.
 * @param {DictionaryTranslationOptions} options - The options for the translation.
 * @returns {string} The translated message.
 *
 * This is a placeholder for the t() function.
 * TODO: Implement the t() function.
 */
export const t: InteralTFunctionType = async (
  id: string,
  options: DictionaryTranslationOptions
): Promise<string> => {
  throw new Error('t() is not implemented');
};
