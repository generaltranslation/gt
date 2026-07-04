import type { DictionaryEntryOptions } from '../../../../translation-functions/types/options';

export type DictionaryLeaf =
  | string
  | [string]
  | [string, DictionaryEntryOptions];

export type Dictionary = {
  [key: string]: DictionaryValue;
};

export type DictionaryValue = DictionaryLeaf | Dictionary;

export type DictionaryEntry = {
  entry: string;
  options: DictionaryEntryOptions;
};

export type DictionaryObject = DictionaryValue;

export type DictionaryPath = string;

export type DictionaryKey = DictionaryPath;
