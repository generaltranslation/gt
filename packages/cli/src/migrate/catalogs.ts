import { hashSource } from 'generaltranslation/id';
import flattenDictionary from '../react/utils/flattenDictionary.js';
import getEntryAndMetadata from '../react/utils/getEntryAndMetadata.js';
import type { Dictionary, DictionaryEntry } from '../types/data.js';
import type { LegacyDataFormat } from './types.js';

const HASH_KEY = /^[0-9a-f]{16}$/;
const PRE_2025_HASH_KEY = /^[0-9a-f]{64}$/;

export type Catalog = Record<string, unknown>;

export type LegacySources = {
  values: Map<string, unknown>;
  /** Formats known for certain, such as ICU for dictionary entries. */
  formats: Map<string, LegacyDataFormat>;
  entries: Map<string, string>;
  kind: 'hashes' | 'dictionary';
};

export type CatalogEra =
  | { era: 'current'; idKeys: number }
  | { era: 'pre-2025'; reason: string };

/** Keys are message hashes, legacy ids and variable names, so inherited properties like `constructor` must not count. */
export function ownValue<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string
): T | undefined {
  return record && Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPre2025Jsx(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isPre2025Jsx);
  return isRecord(value) && 'type' in value && 'props' in value;
}

/** Catalogs from before mid-2025 used 64-character keys and `{type, props}` JSX, which no current hash can be derived from. */
export function detectCatalogEra(catalog: Catalog): CatalogEra {
  let idKeys = 0;
  for (const [key, value] of Object.entries(catalog)) {
    if (PRE_2025_HASH_KEY.test(key)) {
      return { era: 'pre-2025', reason: `it has the 64-character key ${key}` };
    }
    if (isPre2025Jsx(value)) {
      return {
        era: 'pre-2025',
        reason: `the value of ${key} is JSX in the {type, props} form`,
      };
    }
    if (!HASH_KEY.test(key)) idKeys++;
  }
  return { era: 'current', idKeys };
}

const GTJSX_KEYS = new Set(['t', 'i', 'c', 'd', 'k', 'v']);

function isDictionaryNode(value: unknown): boolean {
  return (
    isRecord(value) && Object.keys(value).some((key) => !GTJSX_KEYS.has(key))
  );
}

function isHashCatalog(json: Catalog): boolean {
  return (
    Object.keys(json).some((key) => HASH_KEY.test(key)) &&
    !Object.values(json).some(isDictionaryNode)
  );
}

/** Dictionary entries are keyed by hash and by id, since catalogs from before v11 keyed entries that had an id by the id. */
export function parseLegacySource(json: Catalog): LegacySources {
  if (isHashCatalog(json)) {
    return {
      values: new Map(Object.entries(json)),
      formats: new Map(),
      entries: new Map(),
      kind: 'hashes',
    };
  }
  const values = new Map<string, unknown>();
  const formats = new Map<string, LegacyDataFormat>();
  const entries = new Map<string, string>();
  const dictionary = flattenDictionary(json as Dictionary);
  for (const [id, value] of Object.entries(dictionary)) {
    const { entry, metadata } = getEntryAndMetadata(value as DictionaryEntry);
    if (typeof entry !== 'string') continue;
    const context = metadata?.$context;
    const maxChars = metadata?.$maxChars;
    const meta = {
      ...(context && { context }),
      ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
      dataFormat: 'ICU' as const,
    };
    for (const key of [hashSource({ source: entry, ...meta }), id]) {
      values.set(key, entry);
      formats.set(key, 'ICU');
      entries.set(key, id);
    }
  }
  return { values, formats, entries, kind: 'dictionary' };
}
