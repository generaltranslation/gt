import {
  Dictionary,
  DictionaryEntry,
  getDictionaryEntry as getEntry,
} from 'gt-react/internal';
import { dictionaryNotFoundWarning } from '../errors/createErrors';

let dictionary: Dictionary | undefined = undefined;

export default function getDictionary(): Dictionary | undefined {
  if (dictionary !== undefined) return dictionary;
  try {
    dictionary = require('gt-next/_dictionary').default;
  } catch (error) {
    console.warn(dictionaryNotFoundWarning);
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
