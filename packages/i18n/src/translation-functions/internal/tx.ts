/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { RuntimeTranslationOptions } from '../types';
import { InteralTxFunctionType } from './types';
/**
 * Translates a message at runtime.
 * @param {string} message - The message to translate.
 * @param {RuntimeTranslationOptions} options - The options for the translation.
 * @returns {Promise<string>} The translated message.
 *
 * This is a placeholder for the tx() function.
 * TODO: Implement the tx() function.
 */

export const tx: InteralTxFunctionType = async (
  message: string,
  options: RuntimeTranslationOptions
): Promise<string> => {
  throw new Error('tx() is not implemented');
};
