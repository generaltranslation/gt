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

const I18NEXT_PLURAL_SUFFIX = /_(zero|one|two|few|many|other|\d+)$/;

/**
 * Collapses i18next plural-suffixed keys (`item_one`, `item_few`, …) into
 * one `item_[plural]` unit per family. Locales legitimately carry
 * different CLDR plural categories than the source (Russian needs
 * few/many, Japanese only other), so comparing suffixed keys one-to-one
 * produces false missing/stale reports. A family counts as translated
 * when the translation has any form of it.
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
