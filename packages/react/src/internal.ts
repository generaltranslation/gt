// No useContext related exports should go through here.

import {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
} from '@generaltranslation/react-core/pure';
import { Derive } from '@generaltranslation/react-core/components';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '@generaltranslation/react-core/components-rsc';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

import type { GTProp } from '@generaltranslation/format/types';
import type {
  DictionaryTranslationOptions,
  GTFunctionType,
  InlineTranslationOptions,
  MFunctionType,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
import type { RenderVariable } from '@generaltranslation/react-core/pure';
import type { SharedGTProviderProps } from './provider/GTProviderProps';

export type Entry = string;
export type Metadata = {
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
  [key: string]: unknown;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, Metadata];
export type Dictionary =
  | {
      [key: string]: Dictionary | DictionaryEntry;
    }
  | (Dictionary | DictionaryEntry)[];
export type FlattenedDictionary = Record<string, DictionaryEntry>;
export type RenderMethod = 'skeleton' | 'replace' | 'default';
export type TranslatedChildren = unknown;
export type Translations = Record<string, TranslatedChildren | null>;
export type DictionaryContent = string;
export type DictionaryObject = Record<string, DictionaryContent>;
export type LocalesDictionary = Record<string, DictionaryObject>;
export type CustomLoader = (locale: string) => Promise<unknown>;
export type VariableProps = Record<string, unknown>;
export type _Message = {
  message: string;
  $id?: string;
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
};
export type _Messages = _Message[];

export type GTProviderProps = SharedGTProviderProps;
export type ClientProviderProps = SharedGTProviderProps;

const isPrimitiveOrArray = (value: unknown): boolean =>
  typeof value === 'string' || Array.isArray(value);

const isObjectDictionary = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function get(
  dictionary: Dictionary,
  key: string
): Dictionary | DictionaryEntry | undefined {
  return (dictionary as Record<string, Dictionary | DictionaryEntry>)[key];
}

export function isValidDictionaryEntry(
  value: unknown
): value is DictionaryEntry {
  if (typeof value === 'string') return true;
  if (!Array.isArray(value) || typeof value[0] !== 'string') return false;
  const metadata = value[1];
  return metadata === undefined || (metadata && typeof metadata === 'object');
}

export const isDictionaryEntry = isValidDictionaryEntry;

export function getDictionaryEntry(
  dictionary: Dictionary,
  id: string
): Dictionary | DictionaryEntry | undefined {
  let current: Dictionary | DictionaryEntry = dictionary;
  for (const key of id.split('.')) {
    if (typeof current !== 'object' && !Array.isArray(current)) {
      return undefined;
    }
    const next = get(current as Dictionary, key);
    if (next === undefined) return undefined;
    current = next;
  }
  return current;
}

export function mergeDictionaries(
  defaultLocaleDictionary: Dictionary,
  localeDictionary: Dictionary
): Dictionary {
  if (Array.isArray(defaultLocaleDictionary)) {
    return defaultLocaleDictionary.map((value, key) => {
      if (isDictionaryEntry(value)) {
        return (
          (localeDictionary as (Dictionary | DictionaryEntry)[])[key] ?? value
        );
      }
      return mergeDictionaries(
        value as Dictionary,
        (localeDictionary as (Dictionary | DictionaryEntry)[])[
          key
        ] as Dictionary
      );
    });
  }

  const mergedDictionary: Dictionary = {
    ...Object.fromEntries(
      Object.entries(defaultLocaleDictionary).filter(([, value]) =>
        isPrimitiveOrArray(value)
      )
    ),
    ...Object.fromEntries(
      Object.entries(localeDictionary).filter(([, value]) =>
        isPrimitiveOrArray(value)
      )
    ),
  };

  const defaultDictionaryKeys = Object.entries(defaultLocaleDictionary)
    .filter(([, value]) => isObjectDictionary(value))
    .map(([key]) => key);
  const localeDictionaryKeys = Object.entries(localeDictionary)
    .filter(([, value]) => isObjectDictionary(value))
    .map(([key]) => key);

  for (const key of new Set([
    ...defaultDictionaryKeys,
    ...localeDictionaryKeys,
  ])) {
    mergedDictionary[key] = mergeDictionaries(
      (get(defaultLocaleDictionary, key) || {}) as Dictionary,
      (get(localeDictionary, key) || {}) as Dictionary
    );
  }

  return mergedDictionary;
}

export const getDefaultRenderSettings = (
  environment: 'development' | 'production' | 'test' = 'production'
): {
  method: RenderMethod;
  timeout: number;
} => ({
  method: 'default',
  timeout: environment === 'development' ? 8000 : 12000,
});

export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  Derive,
  derive,
  gtFallback,
  mFallback,
  msg,
  renderDefaultChildren,
  renderTranslatedChildren,
};

export type {
  DictionaryTranslationOptions,
  GTFunctionType,
  GTProp,
  InlineTranslationOptions,
  MFunctionType,
  RenderVariable,
  RuntimeTranslationOptions,
};
