// Slicing for Apple .xcstrings catalogs. One on-disk catalog holds every
// locale; the upload carries the source-language slice as the source document
// and one single-locale slice per translated locale. Slices clone nodes and
// keep only the wanted locale key, so unknown fields survive verbatim at every
// level and a later download-merge can fold per-locale translations back into
// the same on-disk catalog.

export type XcstringsEntry = {
  localizations?: Record<string, unknown>;
  [key: string]: unknown;
};

export type XcstringsCatalog = {
  sourceLanguage: string;
  strings: Record<string, XcstringsEntry>;
  [key: string]: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string, expected: string): Error {
  return new Error(`Invalid .xcstrings content: ${path} must be ${expected}`);
}

// Catalogs are untrusted input. Every container keyed by catalog-chosen names
// (string keys, locales) is built without a prototype, so `constructor` and
// `prototype` are ordinary properties and stay uploadable, matching the
// server's validator. `__proto__` is still rejected: assigning it on a plain
// object reassigns the prototype instead of creating a property.
const RESERVED_KEY_NAME = '__proto__';

function assertSafeKey(name: string, path: string): void {
  if (name === RESERVED_KEY_NAME) {
    throw new Error(
      `Invalid .xcstrings content: ${path} uses the reserved name "${name}"`
    );
  }
}

/**
 * Parses a raw .xcstrings document and validates the structure the slicer
 * traverses. The `strings` and `localizations` containers are re-keyed onto
 * prototype-less records so lookups by catalog-chosen names cannot resolve to
 * inherited properties. Throws on invalid content.
 */
export function parseXcstringsCatalog(content: string): XcstringsCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid .xcstrings content: not valid JSON');
  }
  if (!isPlainObject(parsed)) throw invalid('document root', 'an object');
  if (typeof parsed.sourceLanguage !== 'string' || !parsed.sourceLanguage) {
    throw invalid('sourceLanguage', 'a non-empty string');
  }
  assertSafeKey(parsed.sourceLanguage, 'sourceLanguage');
  if (!isPlainObject(parsed.strings)) throw invalid('strings', 'an object');
  const strings: Record<string, XcstringsEntry> = Object.create(null);
  for (const [key, entry] of Object.entries(parsed.strings)) {
    const path = `strings[${JSON.stringify(key)}]`;
    assertSafeKey(key, path);
    if (!isPlainObject(entry)) throw invalid(path, 'an object');
    if (entry.localizations === undefined) {
      strings[key] = entry;
      continue;
    }
    if (!isPlainObject(entry.localizations)) {
      throw invalid(`${path}.localizations`, 'an object');
    }
    const localizations: Record<string, unknown> = Object.create(null);
    for (const [locale, localization] of Object.entries(entry.localizations)) {
      assertSafeKey(locale, `${path}.localizations[${JSON.stringify(locale)}]`);
      localizations[locale] = localization;
    }
    strings[key] = { ...entry, localizations };
  }
  return { ...parsed, strings } as XcstringsCatalog;
}

/**
 * PINNED SERIALIZATION — DO NOT CHANGE.
 *
 * The source slice is hashed into versionId (see aggregateFiles), so any
 * change to these bytes re-versions every customer .xcstrings file and
 * re-triggers translation fleet-wide. The byte-exact tests on this format are
 * the contract.
 */
export function serializeXcstringsSlice(catalog: XcstringsCatalog): string {
  return JSON.stringify(catalog, null, 2) + '\n';
}

/**
 * Clones a validated catalog keeping, per entry, only `localizations[locale]`.
 * An entry without that localization is kept with its other fields when
 * `keepEntriesWithoutLocale` is set and dropped otherwise. Nodes are cloned,
 * never rebuilt, so unknown fields and key order survive at every level.
 */
function sliceCatalog(
  catalog: XcstringsCatalog,
  locale: string,
  keepEntriesWithoutLocale: boolean
): XcstringsCatalog {
  const strings: Record<string, XcstringsEntry> = Object.create(null);
  for (const [key, entry] of Object.entries(catalog.strings)) {
    if (entry.localizations === undefined) {
      if (keepEntriesWithoutLocale) strings[key] = entry;
      continue;
    }
    const localizations: Record<string, unknown> = Object.create(null);
    if (Object.hasOwn(entry.localizations, locale)) {
      localizations[locale] = entry.localizations[locale];
    } else if (!keepEntriesWithoutLocale) {
      continue;
    }
    strings[key] = { ...entry, localizations };
  }
  return { ...catalog, strings };
}

/**
 * Produces the source-language slice of a validated catalog: a single-locale
 * catalog holding, per entry, only the source-language localization. Entries
 * without localizations (the key itself is the source) are kept verbatim.
 */
export function sliceSourceCatalog(
  catalog: XcstringsCatalog
): XcstringsCatalog {
  return sliceCatalog(catalog, catalog.sourceLanguage, true);
}

/**
 * Produces one locale's translation slice: the entries that carry
 * `localizations[locale]`, each holding only that localization. Returns
 * undefined when the catalog carries no translation for the locale.
 */
export function sliceTranslationCatalog(
  catalog: XcstringsCatalog,
  locale: string
): XcstringsCatalog | undefined {
  const slice = sliceCatalog(catalog, locale, false);
  return Object.keys(slice.strings).length > 0 ? slice : undefined;
}

/**
 * Parses, slices to the catalog's source language, and serializes with the
 * pinned byte layout. Throws on invalid content.
 */
export function parseXcstrings(content: string): string {
  const catalog = parseXcstringsCatalog(content);
  return serializeXcstringsSlice(sliceSourceCatalog(catalog));
}
