import { randomKey } from '../../utils/randomKey';
import {
  findLocaleItem,
  InternationalizedArrayItem,
  isInternationalizedArrayField,
  isRecord,
} from './detect';

/**
 * Upsert the translated value for `targetLocale` into an internationalized
 * array, preserving every other locale item and its (random) `_key`.
 *
 * Sanity mutations can only address array items by `_key`, and `_key` is random
 * here, so we resolve the target item by its `language` field and reuse its
 * existing `_key`; if absent we append a fresh random `_key`.
 */
function upsertLocaleItem(
  baseArray: InternationalizedArrayItem[],
  translatedValue: unknown,
  targetLocale: string,
  sourceLocale: string
): InternationalizedArrayItem[] {
  const itemType = (findLocaleItem(baseArray, sourceLocale) ?? baseArray[0])
    ._type;

  const updated = baseArray.map((item) =>
    item.language === targetLocale
      ? { ...item, value: translatedValue }
      : { ...item }
  );

  if (!findLocaleItem(updated, targetLocale)) {
    updated.push({
      _key: randomKey(),
      _type: itemType,
      language: targetLocale,
      value: translatedValue,
    });
  }

  return updated;
}

/**
 * Merge a single base value with its translated counterpart, returning the new
 * value to write, or `undefined` when nothing localized changed at this level.
 * Recurses through plain objects (by key) and plain arrays (by `_key`) so
 * internationalized-array fields nested inside other content are also handled.
 */
function mergeValue(
  baseValue: unknown,
  translatedValue: unknown,
  targetLocale: string,
  sourceLocale: string
): unknown {
  if (isInternationalizedArrayField(baseValue)) {
    return upsertLocaleItem(
      baseValue,
      translatedValue,
      targetLocale,
      sourceLocale
    );
  }

  if (Array.isArray(baseValue) && Array.isArray(translatedValue)) {
    let changed = false;
    const merged = baseValue.map((item) => {
      if (!isRecord(item) || typeof item._key !== 'string') {
        return item;
      }
      const translatedItem = translatedValue.find(
        (candidate) => isRecord(candidate) && candidate._key === item._key
      );
      if (!translatedItem) {
        return item;
      }
      const mergedItem = mergeValue(
        item,
        translatedItem,
        targetLocale,
        sourceLocale
      );
      if (mergedItem !== undefined) {
        changed = true;
        return mergedItem;
      }
      return item;
    });
    return changed ? merged : undefined;
  }

  if (isRecord(baseValue) && isRecord(translatedValue)) {
    let changed = false;
    const merged: Record<string, unknown> = { ...baseValue };
    for (const key of Object.keys(translatedValue)) {
      if (key.startsWith('_') || !(key in baseValue)) {
        continue;
      }
      const mergedChild = mergeValue(
        baseValue[key],
        translatedValue[key],
        targetLocale,
        sourceLocale
      );
      if (mergedChild !== undefined) {
        merged[key] = mergedChild;
        changed = true;
      }
    }
    return changed ? merged : undefined;
  }

  return undefined;
}

/**
 * Compare a base Sanity document against a deserialized translation and produce
 * a patch object of top-level fields whose internationalized-array content
 * changed. Each entry is the full merged top-level value (with the target
 * locale upserted), suitable for `client.patch(id).set(changes)`.
 *
 * Only top-level fields that actually changed are returned, so unrelated
 * content and other locales are left untouched.
 */
export function mergeInternationalizedArrays(
  baseDoc: Record<string, unknown>,
  translatedFields: Record<string, unknown>,
  targetLocale: string,
  sourceLocale: string
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};

  for (const key of Object.keys(translatedFields)) {
    if (key.startsWith('_') || !(key in baseDoc)) {
      continue;
    }
    const merged = mergeValue(
      baseDoc[key],
      translatedFields[key],
      targetLocale,
      sourceLocale
    );
    if (merged !== undefined) {
      changes[key] = merged;
    }
  }

  return changes;
}
