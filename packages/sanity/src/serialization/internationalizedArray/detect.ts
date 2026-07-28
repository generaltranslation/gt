// Helpers for recognising the `sanity-plugin-internationalized-array` storage
// shape, where a localized field is stored as an array of per-locale items:
//
//   title: [
//     { _key: 'abc', _type: 'internationalizedArrayStringValue', language: 'en', value: 'Hello' },
//     { _key: 'def', _type: 'internationalizedArrayStringValue', language: 'es', value: 'Hola' },
//   ]
//
// Detection is shape-based (not schema-based) so the serializer/merger do not
// have to thread the schema through every call, but it is anchored on the
// value `_type` naming convention (`internationalizedArray…Value`) so
// user-defined types that merely share the `{ language, value }` shape are
// not misdetected. The prefix is fixed by sanity-plugin-internationalized-array.
const TYPE_PREFIX = 'internationalizedArray';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type InternationalizedArrayItem = {
  _key?: string;
  _type: string;
  language: string;
  value: unknown;
};

/**
 * A single `{ _key, _type, language, value }` entry. The `_type` of the
 * generated value objects is always `internationalizedArray<FieldType>Value`
 * (e.g. `internationalizedArrayStringValue`), so both the prefix and the
 * `Value` suffix are required — a bare `endsWith('Value')` check would
 * misdetect user-defined types like `priceValue` that happen to carry
 * `language`/`value` keys.
 */
export function isInternationalizedArrayItem(
  item: unknown
): item is InternationalizedArrayItem {
  return (
    isRecord(item) &&
    typeof item._type === 'string' &&
    item._type.startsWith(TYPE_PREFIX) &&
    item._type.endsWith('Value') &&
    typeof item.language === 'string' &&
    'value' in item
  );
}

/**
 * A non-empty array where every element is an internationalized-array item.
 */
export function isInternationalizedArrayField(
  value: unknown
): value is InternationalizedArrayItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isInternationalizedArrayItem)
  );
}

/**
 * Returns the item for a given locale, matching on the exact `language` id
 * (hyphens preserved, e.g. `fr-CA`). Never matches on `_key`, which is random.
 */
export function findLocaleItem(
  field: InternationalizedArrayItem[],
  locale: string
): InternationalizedArrayItem | undefined {
  return field.find((item) => item.language === locale);
}
