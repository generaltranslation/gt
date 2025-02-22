import {
  Dictionary,
  DictionaryEntry,
  getDictionaryEntry as getEntry,
} from 'gt-react/internal';
import { dictionaryNotFoundWarning } from '../errors/createErrors';

let dictionary: Dictionary | undefined = undefined;

export default function getDictionary(): Dictionary | undefined {
  if (dictionary !== undefined) return dictionary;
  const dictionaryFileType =
    process.env._GENERALTRANSLATION_DICTIONARY_FILE_TYPE;
  try {
    if (dictionaryFileType === '.json') {
      dictionary = require('gt-next/_dictionary');
    } else if (dictionaryFileType === '.ts' || dictionaryFileType === '.js') {
      dictionary = require('gt-next/_dictionary').default;
    } else {
      dictionary = {};
    }
  } catch {
    if (dictionaryFileType) {
      console.warn(dictionaryNotFoundWarning);
    }
    dictionary = {};
  }
  return dictionary;
}

export function getDictionaryEntry(
  id: string
): Dictionary | DictionaryEntry | undefined {
  const obj = getDictionary();
  if (!obj) return undefined;
  return getEntry(obj, id);
}
