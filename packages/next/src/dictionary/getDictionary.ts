import {
  Dictionary,
  DictionaryEntry,
  getDictionaryEntry as getEntry,
} from 'gt-react/internal';
import {
  customLoadDictionaryWarning,
  dictionaryNotFoundWarning,
} from '../errors/createErrors';
import resolveDictionaryLoader from '../loaders/resolveDictionary';
import defaultWithGTConfigProps from '../config-dir/props/defaultWithGTConfigProps';
import { getLocaleProperties } from 'generaltranslation';

let dictionary: Dictionary | undefined = undefined;

export default async function getDictionary(): Promise<Dictionary | undefined> {
  // Singleton pattern
  if (dictionary !== undefined) return dictionary;

  // Get dictionary file type
  const dictionaryFileType =
    process.env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE;

  // First, check for a dictionary file (takes precedence)
  try {
    if (dictionaryFileType === '.json') {
      dictionary = require('gt-next/_dictionary');
    } else if (dictionaryFileType === '.ts' || dictionaryFileType === '.js') {
      dictionary = require('gt-next/_dictionary').default;
    }
  } catch {}
  if (dictionary) return dictionary;

  // Second, check for custom dictionary loader
  const customLoadDictionary = resolveDictionaryLoader(); // must be user defined bc compiler reasons
  if (customLoadDictionary) {
    const defaultLocale =
      process.env._GENERALTRANSLATION_DEFAULT_LOCALE ||
      defaultWithGTConfigProps.defaultLocale;

    // Check for [defaultLocale.json] file
    try {
      dictionary = await customLoadDictionary(defaultLocale);
    } catch {}

    // Check the simplified locale name ('en' instead of 'en-US')
    const languageCode = getLocaleProperties(defaultLocale)?.languageCode;
    if (!dictionary && languageCode && languageCode !== defaultLocale) {
      try {
        dictionary = await customLoadDictionary(languageCode);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(customLoadDictionaryWarning(languageCode), error);
        }
      }
    }
  }

  if (!dictionary) {
    dictionary = {};
  }

  return dictionary;
}

export function getDictionaryEntry(
  id: string
): Dictionary | DictionaryEntry | undefined {
  if (!dictionary) return undefined;
  return getEntry(dictionary, id);
}
