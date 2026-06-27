/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports
 * instead. This subpath is kept only for gt-next compatibility.
 */

import type {
  CustomLoader,
  Dictionary,
  DictionaryEntry,
  RenderMethod,
  Translations,
} from '@generaltranslation/react-core/pure';

export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

export type {
  CustomLoader,
  Dictionary,
  DictionaryEntry,
  RenderMethod,
  Translations,
};

function get(dictionary: Dictionary, id: string | number) {
  if (dictionary == null) {
    throw new Error('Cannot index into an undefined dictionary');
  }
  if (Array.isArray(dictionary)) {
    return dictionary[id as number];
  }
  return dictionary[id as string];
}

function isDictionaryEntry(value: unknown): value is DictionaryEntry {
  if (typeof value === 'string') return true;
  if (!Array.isArray(value) || typeof value[0] !== 'string') return false;

  const metadata = value[1];
  return typeof metadata === 'undefined' || typeof metadata === 'object';
}

const isPrimitiveOrArray = (value: unknown): boolean =>
  typeof value === 'string' || Array.isArray(value);

const isObjectDictionary = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function getDefaultRenderSettings(
  environment: 'development' | 'production' | 'test' = 'production'
): {
  method: RenderMethod;
  timeout: number;
} {
  return {
    method: 'default',
    timeout: environment === 'development' ? 8000 : 12000,
  };
}

export function getDictionaryEntry<T extends Dictionary>(
  dictionary: T,
  id: string
): Dictionary | DictionaryEntry | undefined {
  let current: Dictionary | DictionaryEntry = dictionary;
  const dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    if (typeof current !== 'object' && !Array.isArray(current)) {
      return undefined;
    }
    current = get(current as Dictionary, key);
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
        return (localeDictionary as (Dictionary | DictionaryEntry)[])[key];
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

  const allKeys = new Set([...defaultDictionaryKeys, ...localeDictionaryKeys]);
  for (const key of allKeys) {
    mergedDictionary[key] = mergeDictionaries(
      (get(defaultLocaleDictionary, key) || {}) as Dictionary,
      (get(localeDictionary, key) || {}) as Dictionary
    );
  }

  return mergedDictionary;
}
