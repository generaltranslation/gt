import * as fs from 'fs';
import { logger } from '../../console/logger.js';
import { gt } from '../../utils/gt.js';
import {
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  type XcstringsEntry,
} from './parseXcstrings.js';

/**
 * Folds one locale's downloaded translations into the catalog at `inputPath`.
 *
 * Catalog keys are canonical tags and the configured `locale` may be a custom
 * alias, so the alias is resolved before it is used as the key on either side.
 * The catalog is read fresh so a batch of locales accumulates. It is truth for
 * everything except that key: for each entry the download carries that
 * localization for, only it is copied into the catalog's entry. Entries,
 * entry-level fields, other locales, and unknown fields at every level are
 * untouched. Keys the download did not translate are left alone; keys the
 * catalog no longer has are skipped with a warning. Throws on invalid content.
 */
export function mergeXcstringsLocale(
  downloadedContent: string,
  locale: string,
  inputPath: string
): string {
  const canonicalLocale = gt.resolveCanonicalLocale(locale);
  const catalog = parseXcstringsCatalog(fs.readFileSync(inputPath, 'utf8'));
  const downloaded = parseXcstringsCatalog(downloadedContent);

  const strings: Record<string, XcstringsEntry> = Object.create(null);
  for (const [key, entry] of Object.entries(catalog.strings)) {
    strings[key] = entry;
  }

  const unmatchedKeys: string[] = [];
  for (const [key, downloadedEntry] of Object.entries(downloaded.strings)) {
    const localization = downloadedEntry.localizations?.[canonicalLocale];
    if (localization === undefined) continue;
    const entry = strings[key];
    if (entry === undefined) {
      unmatchedKeys.push(key);
      continue;
    }
    strings[key] = {
      ...entry,
      localizations: withLocalization(
        entry.localizations,
        canonicalLocale,
        localization
      ),
    };
  }

  if (unmatchedKeys.length > 0) {
    logger.warn(
      `Skipped ${unmatchedKeys.length} downloaded ${locale} translation(s) with no matching entry in the local catalog: ${unmatchedKeys
        .map((key) => JSON.stringify(key))
        .join(', ')}`
    );
  }

  return serializeXcstringsSlice({ ...catalog, strings });
}

/**
 * Clones `localizations` with `locale` set. An existing locale keeps its
 * position; a new one is inserted before the first existing key that sorts
 * after it, so the bytes do not depend on the order locales were downloaded
 * and keys already present never move.
 */
function withLocalization(
  localizations: Record<string, unknown> | undefined,
  locale: string,
  localization: unknown
): Record<string, unknown> {
  const merged: Record<string, unknown> = Object.create(null);
  let inserted = false;
  for (const [existing, value] of Object.entries(localizations ?? {})) {
    if (existing === locale) {
      merged[locale] = localization;
      inserted = true;
      continue;
    }
    if (!inserted && locale < existing) {
      merged[locale] = localization;
      inserted = true;
    }
    merged[existing] = value;
  }
  if (!inserted) merged[locale] = localization;
  return merged;
}
