import type { DictionaryConfig } from 'gt-i18n/internal/compat';

/**
 * Replaced at build time by the gt-tanstack-start Vite plugin with the app's
 * dictionary and dictionary loader. Only compat (dictionary) code imports it,
 * so apps that do not use the dictionary API never bundle their dictionary.
 */
export const dictionary: DictionaryConfig['dictionary'] = undefined;

export const loadDictionary: DictionaryConfig['loadDictionary'] = undefined;
