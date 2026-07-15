import {
  findLocaleItem,
  isInternationalizedArrayField,
  isRecord,
} from './detect';

/**
 * Collapse every internationalized-array field in a value down to just its
 * source-locale `value`, recursing into nested objects/arrays.
 *
 * This runs *before* the generic HTML serializer so that the per-locale item
 * arrays never reach `serializeArray` (which would otherwise emit every
 * locale). After collapsing, an `internationalizedArrayString` field is a plain
 * string, an `internationalizedArrayText` is a plain string, Portable Text is a
 * plain `block` array, and a custom value object is a plain object — all shapes
 * the existing document-level serializer already round-trips.
 *
 * Returns `undefined` when a field has no source-locale entry, so the caller
 * drops it (nothing to translate) rather than emitting an empty field.
 */
export function collapseToSourceLocale(
  value: unknown,
  sourceLocale: string
): unknown {
  if (isInternationalizedArrayField(value)) {
    const sourceItem = findLocaleItem(value, sourceLocale);
    if (!sourceItem) {
      return undefined;
    }
    // Recurse: the source value may itself contain nested localized fields.
    return collapseToSourceLocale(sourceItem.value, sourceLocale);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => collapseToSourceLocale(item, sourceLocale))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const collapsed: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const collapsedValue = collapseToSourceLocale(value[key], sourceLocale);
      if (collapsedValue !== undefined) {
        collapsed[key] = collapsedValue;
      }
    }
    return collapsed;
  }

  return value;
}
