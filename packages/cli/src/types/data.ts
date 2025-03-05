export type Entry = string;
export type DictionaryMetadata = {
  context?: string;
  variablesOptions?: Record<string, any>;
  [key: string]: any;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, DictionaryMetadata];
export type Dictionary = {
  [key: string]: Dictionary | DictionaryEntry;
};
export type FlattenedDictionary = {
  [key: string]: DictionaryEntry;
};

export type DataFormat = 'gt' | 'next-intl' | 'react-i18next' | 'next-i18next';

export type FileExtension = 'json' | 'yaml' | 'yml';

export type JsxChildren = string | string[] | any;

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
