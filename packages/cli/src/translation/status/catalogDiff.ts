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

/** Diffs a translated catalog against its source; pass `null` when the file is absent. */
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

const I18NEXT_PLURAL_SUFFIX = /_(zero|one|two|few|many|other|\d+)$/;

/**
 * Collapses i18next plural suffixes into one unit per family; CLDR categories differ by locale.
 */
export function collapseI18nextPlurals(
  pointers: Record<string, unknown>
): Record<string, unknown> {
  const collapsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pointers)) {
    const familyKey = key.replace(I18NEXT_PLURAL_SUFFIX, '_[plural]');
    if (!(familyKey in collapsed)) {
      collapsed[familyKey] = value;
    }
  }
  return collapsed;
}
