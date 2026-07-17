export type CatalogDiff = {
  /** Number of translatable units in the source catalog */
  total: number;
  /** Number of source units present in the translated catalog */
  translated: number;
  /** Source keys with no entry in the translated catalog */
  missing: string[];
  /** Translated keys whose source entry no longer exists */
  stale: string[];
};

/**
 * Diffs a translated key/value catalog against its source catalog.
 * Pass `null` for a catalog that does not exist on disk — every source
 * key is then missing.
 */
export function diffKeyedCatalog(
  source: Record<string, unknown>,
  translation: Record<string, unknown> | null
): CatalogDiff {
  const sourceKeys = Object.keys(source);
  if (!translation) {
    return {
      total: sourceKeys.length,
      translated: 0,
      missing: sourceKeys,
      stale: [],
    };
  }

  const missing = sourceKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(translation, key)
  );
  const stale = Object.keys(translation).filter(
    (key) => !Object.prototype.hasOwnProperty.call(source, key)
  );

  return {
    total: sourceKeys.length,
    translated: sourceKeys.length - missing.length,
    missing,
    stale,
  };
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Flattens a parsed JSON value into a map of RFC 6901 JSON pointers to
 * string leaves. Non-string leaves (numbers, booleans, null) are skipped —
 * only strings are translatable.
 */
export function flattenStringLeaves(
  json: unknown,
  pointer: string = '',
  result: Record<string, string> = {}
): Record<string, string> {
  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      flattenStringLeaves(item, `${pointer}/${index}`, result);
    });
  } else if (json && typeof json === 'object') {
    for (const [key, value] of Object.entries(json)) {
      flattenStringLeaves(value, `${pointer}/${escapePointerSegment(key)}`, result);
    }
  } else if (typeof json === 'string' && pointer) {
    result[pointer] = json;
  }
  return result;
}
