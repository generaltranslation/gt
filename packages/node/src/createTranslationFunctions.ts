import {
  createGtFunction,
  createMFunction,
  // createTFunction,
  // createTxFunction,
  I18nManager,
} from 'gt-i18n/internal';

/**
 * Creates the translation functions for the node environment.
 * @param i18nManager - The i18n manager to use.
 * @returns The translation functions.
 */
export function createTranslationFunctions(i18nManager: I18nManager) {
  return {
    gt: createGtFunction(i18nManager),
    m: createMFunction(i18nManager),
    // Not yet implemented
    // t: createTFunction(i18nManager),
    // tx: createTxFunction(i18nManager),
  };
}
