export type Entry = string;
export type DictionaryMetadata = {
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
  [key: string]: unknown;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, DictionaryMetadata];
export type Dictionary = {
  [key: string]: Dictionary | DictionaryEntry;
};
export type FlattenedDictionary = {
  [key: string]: DictionaryEntry;
};

export type JSONDictionary = {
  [key: string]: string | JSONDictionary;
};

export type FlattenedJSONDictionary = {
  [key: string]: string;
};

export type { DataFormat } from '@generaltranslation/format/types';
export type { FileFormat, FileToUpload } from 'generaltranslation/types';

export type JsxChildren = string | string[] | unknown;

export type Translations = {
  // keys are sha256 hashes
  [key: string]: JsxChildren;
};

export type TranslationsMetadata = {
  // keys are sha256 hashes
  [key: string]: {
    id?: string;
    hash?: string;
  };
};
