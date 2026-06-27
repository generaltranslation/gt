import {
  getDictionaryEntry as getEntry,
  type Dictionary,
  type DictionaryEntry,
} from '@generaltranslation/react-core/pure';
import { customLoadDictionaryWarning } from '../errors/createErrors';
import { resolveDictionaryLoader } from '../resolvers/resolveDictionaryLoader';
import { defaultWithGTConfigProps } from '../config-dir/props/defaultWithGTConfigProps';
import { getLocaleProperties } from '@generaltranslation/format';

export let internalDictionary: Dictionary | undefined = undefined;

export async function getDictionary(): Promise<Dictionary | undefined> {
  // Singleton pattern
  if (internalDictionary !== undefined) return internalDictionary;

  // Get dictionary file type
  const dictionaryFileType =
    process.env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE;

  // First, check for a dictionary file (takes precedence)
  try {
    if (dictionaryFileType === '.json') {
      internalDictionary = require('gt-next/_dictionary');
    } else if (dictionaryFileType === '.ts' || dictionaryFileType === '.js') {
      const bundledDictionary = require('gt-next/_dictionary');
      internalDictionary =
        bundledDictionary.default || bundledDictionary.dictionary;
    }
  } catch {
    // No bundled dictionary module was generated.
  }
  if (internalDictionary) return internalDictionary;

  // Second, check for custom dictionary loader
  const customLoadDictionary = resolveDictionaryLoader(); // must be user defined bc compiler reasons
  if (customLoadDictionary) {
    const defaultLocale =
      process.env._GENERALTRANSLATION_DEFAULT_LOCALE ||
      defaultWithGTConfigProps.defaultLocale;

    // Check for [defaultLocale.json] file
    try {
      internalDictionary = (await customLoadDictionary(defaultLocale)) as
        | Dictionary
        | undefined;
    } catch {
      // Missing default-locale dictionaries fall through to language fallback.
    }

    // Check the simplified locale name ('en' instead of 'en-US')
    const languageCode = getLocaleProperties(defaultLocale)?.languageCode;
    if (!internalDictionary && languageCode && languageCode !== defaultLocale) {
      try {
        internalDictionary = (await customLoadDictionary(languageCode)) as
          | Dictionary
          | undefined;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(customLoadDictionaryWarning(languageCode), error);
        }
      }
    }
  }

  if (!internalDictionary) {
    internalDictionary = {};
  }

  return internalDictionary;
}

export function getDictionaryEntry(
  id: string
): Dictionary | DictionaryEntry | undefined {
  if (!internalDictionary) return undefined;
  return getEntry(internalDictionary, id);
}
