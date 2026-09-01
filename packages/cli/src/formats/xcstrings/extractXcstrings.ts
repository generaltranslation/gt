import { logger } from '../../console/logger.js';
import {
  filterLocalizations,
  parseXcstringsCatalog,
  serializeXcstrings,
  type XcstringsEntry,
} from './parseXcstrings.js';

/**
 * Extracts one target locale's slice from a multi-locale .xcstrings catalog.
 * The slice is a partial overlay, mirroring how extractJson produces
 * only-translated content: entries lacking the locale are omitted, and kept
 * entries are cloned with only that locale's localization so unknown fields
 * and entry order are preserved. Returns null when the content is invalid or
 * the catalog holds nothing for the locale (no translation upload).
 */
export function extractXcstrings(
  localContent: string,
  fileName: string,
  targetLocale: string
): string | null {
  let catalog: ReturnType<typeof parseXcstringsCatalog>;
  try {
    catalog = parseXcstringsCatalog(localContent);
  } catch {
    logger.error(`Invalid .xcstrings file: ${fileName}`);
    return null;
  }

  const slicedEntries: [string, XcstringsEntry][] = [];
  for (const [key, entry] of Object.entries(catalog.strings)) {
    if (entry.localizations === undefined) continue;
    const localizations = filterLocalizations(
      entry.localizations,
      targetLocale
    );
    if (Object.keys(localizations).length === 0) continue;
    slicedEntries.push([key, { ...entry, localizations }]);
  }
  if (slicedEntries.length === 0) return null;

  return serializeXcstrings({
    ...catalog,
    strings: Object.fromEntries(slicedEntries),
  });
}
