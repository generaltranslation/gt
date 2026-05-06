import type {
  Dictionary,
  DictionaryEntry,
  DictionaryLeaf,
  DictionaryPath,
  DictionaryValue,
} from './types/dictionary';
import type { DictionaryOptions } from '../../../translation-functions/types/options';

export function getDictionaryPath(id: DictionaryPath): string[] {
  if (!id) {
    return [];
  }
  return id.split('.');
}

export function isDictionaryValue(value: unknown): value is Dictionary {
  return typeof value === 'object' && value != null && !Array.isArray(value);
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
): DictionaryOptions {
  return {
    ...options,
    ...(options.$context === undefined &&
      typeof options.context === 'string' && { $context: options.context }),
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
  return value.length === 2 && isDictionaryOptions(value[1]);
}

function isDictionaryOptions(value: unknown): value is DictionaryOptions {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const options = value as Record<string, unknown>;
  return (
    (options.$context === undefined || typeof options.$context === 'string') &&
    (options.$maxChars === undefined ||
      typeof options.$maxChars === 'number') &&
    (options.context === undefined || typeof options.context === 'string')
  );
}

export function replaceDictionary(
  target: Dictionary,
  source: Dictionary
): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}
