import {
  Dictionary,
  DictionaryEntry,
  getDictionaryEntry as getEntry,
} from 'gt-react/internal';
import {
  customLoadMessagesWarning,
  dictionaryNotFoundWarning,
} from '../errors/createErrors';
import resolveMessageLoader from '../loaders/resolveMessagesLoader';
import defaultInitGTProps from '../config-dir/props/defaultInitGTProps';
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

  // Second, check for custom message loader
  const customLoadMessages = resolveMessageLoader(); // must be user defined bc compiler reasons
  if (customLoadMessages) {
    const defaultLocale =
      process.env._GENERALTRANSLATION_DEFAULT_LOCALE ||
      defaultInitGTProps.defaultLocale;

    // Check for [defaultLocale.json] file
    try {
      dictionary = await customLoadMessages(defaultLocale);
    } catch {}

    // Check the simplified locale name ('en' instead of 'en-US')
    const languageCode = getLocaleProperties(defaultLocale)?.languageCode;
    if (!dictionary && languageCode && languageCode !== defaultLocale) {
      try {
        dictionary = await customLoadMessages(languageCode);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(customLoadMessagesWarning(languageCode), error);
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
