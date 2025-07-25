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

export type JSONDictionary = {
  [key: string]: string | JSONDictionary;
};

export type FlattenedJSONDictionary = {
  [key: string]: string;
};

export type {
  FileFormat,
  DataFormat,
  FileToTranslate,
} from 'generaltranslation/types';

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
