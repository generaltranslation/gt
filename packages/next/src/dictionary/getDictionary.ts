import { type Dictionary } from 'gt-i18n/types';

export let internalDictionary: Dictionary | undefined = undefined;

export function getDictionary(): Dictionary | undefined {
  // Singleton pattern
  if (internalDictionary !== undefined) return internalDictionary;

  // Get dictionary file type
  const dictionaryFileType =
    process.env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE;

  // Check for a dictionary file
  try {
    if (dictionaryFileType === '.json') {
      internalDictionary = require('gt-next/internal/_dictionary');
    } else if (dictionaryFileType === '.ts' || dictionaryFileType === '.js') {
      const bundledDictionary = require('gt-next/internal/_dictionary');
      internalDictionary =
        bundledDictionary.default || bundledDictionary.dictionary;
    }
  } catch {
    // No bundled dictionary module was generated.
  }
  if (internalDictionary) return internalDictionary;
  internalDictionary = {};
  return internalDictionary;
}
