import type { DictionaryOptions } from '../../../../translation-functions/types/options';
export type { DictionaryOptions } from '../../../../translation-functions/types/options';

export type DictionaryLeaf = string | [string] | [string, DictionaryOptions];

export type Dictionary = {
  [key: string]: DictionaryValue;
};

export type DictionaryValue = DictionaryLeaf | Dictionary;

export type DictionaryEntry = string;

export type DictionaryPath = string;

export type DictionaryKey = DictionaryPath;
