import type {
  Dictionary,
  DictionaryEntry,
  DictionaryLeaf,
  DictionaryPath,
  DictionaryValue,
} from './types/dictionary';
import type {
  DictionaryEntryOptions,
  LookupOptions,
} from '../../../translation-functions/types/options';
import { DICTIONARY_OPTION_KEYS } from '../../../translation-functions/reservedKeys';
import type { StringFormat } from '@generaltranslation/format/types';

function getDictionaryPath(id: DictionaryPath): string[] {
  const path = id ? id.split('.') : [];
  for (const segment of path) {
    assertSafeDictionaryPathSegment(segment, id);
  }
  return path;
}

export function assertSafeDictionaryPathSegment(
  segment: string,
  path: DictionaryPath
): void {
  if (
    segment === '__proto__' ||
    segment === 'constructor' ||
    segment === 'prototype'
  ) {
    throw new Error(`Dictionary path "${path}" contains an unsafe segment`);
  }
}

export function isDictionaryValue(value: unknown): value is Dictionary {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

export function isDictionaryObject(value: unknown): value is Dictionary {
  return isDictionaryValue(value);
}

export function cloneDictionaryValue<Value extends DictionaryValue | undefined>(
  value: Value
): Value {
  if (value === undefined || typeof value === 'string') {
    return value;
  }
  return structuredClone(value) as Value;
}

export function getDictionaryValueAtPath(
  dictionary: Dictionary,
  path: DictionaryPath
): DictionaryValue | undefined {
  let current: DictionaryValue = dictionary;

  for (const segment of getDictionaryPath(path)) {
    if (!isDictionaryObject(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

export function setDictionaryValueAtPath(
  dictionary: Dictionary,
  path: DictionaryPath,
  value: DictionaryValue
): void {
  const segments = getDictionaryPath(path);
  if (isDictionaryObject(value)) {
    assertSafeDictionaryObject(value, path);
  }

  if (segments.length === 0) {
    if (isDictionaryObject(value)) {
      replaceDictionary(dictionary, value);
    }
    return;
  }

  let current = dictionary;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!isDictionaryObject(next)) {
      current[segment] = {} as Dictionary;
    }
    current = current[segment] as Dictionary;
  }

  const leafSegment = segments[segments.length - 1];
  current[leafSegment] = value;
}

export function getDictionaryEntry(
  value: DictionaryValue | undefined
): DictionaryEntry | undefined {
  if (!isDictionaryLeafNode(value)) {
    return undefined;
  }
  return {
    entry: Array.isArray(value) ? value[0] : value,
    options: Array.isArray(value) ? (value[1] ?? {}) : {},
  };
}

export function getDictionaryValue(value: DictionaryEntry): DictionaryValue {
  if (Object.keys(value.options).length === 0) {
    return value.entry;
  }
  return [value.entry, value.options];
}

export function resolveDictionaryLookupOptions(
  options: DictionaryEntry['options']
): LookupOptions<StringFormat> {
  const { $format, ...rest } = options;
  return {
    ...rest,
    $format: isStringFormat($format) ? $format : 'ICU',
  };
}

function isDictionaryLeafNode(value: unknown): value is DictionaryLeaf {
  if (typeof value === 'string') {
    return true;
  }
  if (!Array.isArray(value) || typeof value[0] !== 'string') {
    return false;
  }
  if (value.length === 1) {
    return true;
  }
  return value.length === 2 && isDictionaryEntryOptions(value[1]);
}

// Per-key validators for the dictionary option subset. The key set comes from
// the reserved-key registry (DICTIONARY_OPTION_KEYS); this map just supplies the
// expected type for each. Keyed by that subset, so adding a dictionary option
// key to the registry forces a validator here (compile error otherwise).
const DICTIONARY_OPTION_VALIDATORS: Record<
  (typeof DICTIONARY_OPTION_KEYS)[number],
  (value: unknown) => boolean
> = {
  $context: (value) => typeof value === 'string',
  $format: (value) => isStringFormat(value),
  $maxChars: (value) => typeof value === 'number',
};

function isDictionaryEntryOptions(
  value: unknown
): value is DictionaryEntryOptions {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const options = value as Record<string, unknown>;
  return DICTIONARY_OPTION_KEYS.every(
    (key) =>
      options[key] === undefined ||
      DICTIONARY_OPTION_VALIDATORS[key](options[key])
  );
}

function isStringFormat(value: unknown): value is StringFormat {
  return value === 'ICU' || value === 'I18NEXT' || value === 'STRING';
}

function replaceDictionary(target: Dictionary, source: Dictionary): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  for (const key of Object.keys(source)) {
    target[key] = source[key];
  }
}

function assertSafeDictionaryObject(
  dictionary: Dictionary,
  parentPath = ''
): void {
  for (const [key, value] of Object.entries(dictionary)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    assertSafeDictionaryPathSegment(key, path);
    if (isDictionaryObject(value)) {
      assertSafeDictionaryObject(value, path);
    }
  }
}
