// Slicing for Apple .xcstrings catalogs. One on-disk catalog holds every
// locale; uploads carry one single-locale slice per language. Slices are
// produced by cloning nodes and removing only foreign locale keys, so unknown
// fields survive verbatim at every level.

export type XcstringsEntry = {
  localizations?: Record<string, unknown>;
  shouldTranslate?: boolean;
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

// Catalogs are untrusted input; these names resolve to inherited properties
// on plain objects, so downstream key writes could escape into prototypes.
// No real catalog uses them; fail loud.
const RESERVED_KEY_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeKey(name: string, path: string): void {
  if (RESERVED_KEY_NAMES.has(name)) {
    throw new Error(
      `Invalid .xcstrings content: ${path} uses the reserved name "${name}"`
    );
  }
}

/**
 * Parses a raw .xcstrings document and validates the structure the slicers
 * traverse. Throws on invalid content.
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
  for (const [key, entry] of Object.entries(parsed.strings)) {
    const path = `strings[${JSON.stringify(key)}]`;
    assertSafeKey(key, path);
    if (!isPlainObject(entry)) throw invalid(path, 'an object');
    if (entry.localizations === undefined) continue;
    if (!isPlainObject(entry.localizations)) {
      throw invalid(`${path}.localizations`, 'an object');
    }
    for (const locale of Object.keys(entry.localizations)) {
      assertSafeKey(locale, `${path}.localizations[${JSON.stringify(locale)}]`);
    }
  }
  return parsed as XcstringsCatalog;
}

/**
 * PINNED SERIALIZATION — DO NOT CHANGE.
 *
 * versionId is a hash of this exact byte output (hashVersionId over the
 * slice in aggregateFiles), so any change here re-versions every customer
 * xcstrings file and re-triggers translation fleet-wide. Download merges
 * (mergeXcstrings) also write catalogs through it, so repeated merges must
 * round-trip byte-identically. The byte-exact tests on this format are the
 * contract.
 */
export function serializeXcstrings(catalog: XcstringsCatalog): string {
  return JSON.stringify(catalog, null, 2) + '\n';
}

/** Clones a localizations record keeping only the given locale's key. */
export function filterLocalizations(
  localizations: Record<string, unknown>,
  locale: string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(localizations).filter(([key]) => key === locale)
  );
}

/**
 * Produces the source-language slice of a catalog: a valid single-locale
 * catalog containing, per entry, only the source-language localization.
 * Entries with no localizations (the key is the source) and
 * shouldTranslate:false entries are kept verbatim. An entry holding only
 * non-source locales slices to the same implicit form (no localizations
 * key), so the slice — and the versionId hashed from it — is invariant to
 * target-locale translations merged into the catalog. Entry order and
 * unknown fields are preserved. Throws on invalid content.
 */
export function parseXcstrings(content: string): string {
  const catalog = parseXcstringsCatalog(content);
  const slicedEntries: [string, XcstringsEntry][] = [];
  for (const [key, entry] of Object.entries(catalog.strings)) {
    if (entry.shouldTranslate === false || entry.localizations === undefined) {
      slicedEntries.push([key, entry]);
      continue;
    }
    const localizations = filterLocalizations(
      entry.localizations,
      catalog.sourceLanguage
    );
    if (Object.keys(localizations).length === 0) {
      const { localizations: _dropped, ...implicitEntry } = entry;
      slicedEntries.push([key, implicitEntry]);
      continue;
    }
    slicedEntries.push([key, { ...entry, localizations }]);
  }
  return serializeXcstrings({
    ...catalog,
    strings: Object.fromEntries(slicedEntries),
  });
}
