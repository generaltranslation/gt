import type { StringFormat } from '@generaltranslation/format';
import type {
  TranslationMetadata,
  TranslationVariables,
} from '../translation-functions/types/options';

export type DictionaryEntryOptions = TranslationVariables &
  Pick<TranslationMetadata, '$context' | '$format' | '$maxChars'>;

export type DictionaryLookupOptions = DictionaryEntryOptions & {
  $format: StringFormat;
};

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

export type DictionaryLoader = (locale: string) => Promise<Dictionary>;

export type DictionaryConfig = {
  dictionary?: Dictionary;
  loadDictionary?: DictionaryLoader;
};

export type DictionaryObjectTranslation =
  | string
  | {
      [key: string]: DictionaryObjectTranslation;
    };

/**
 * Type for the t() function
 * @param {string} id - The id of the translation to translate.
 * @param {TranslationVariables} options - The variables for interpolation.
 * @returns {string} The translated message.
 * TODO: next major version, remove the "...type" suffix, it's redundant
 */
export type TFunctionType = ((
  id: string,
  options?: TranslationVariables
) => string) & {
  obj: (id: string) => DictionaryObjectTranslation;
};
