import { promises as fs } from 'fs';
import {
  Dictionary,
  DictionaryEntry,
  getDictionaryEntry as getEntry,
} from 'gt-react/internal';

let dictionary: Dictionary | undefined = undefined;

export default function getDictionary(): Dictionary | undefined {
  if (dictionary) return dictionary;
  try {
    dictionary = require('gt-next/_dictionary').default;
  } catch (error) {
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
