import { logger } from '../../console/logger.js';
import {
  parseXcstringsCatalog,
  serializeXcstrings,
  type XcstringsEntry,
} from './parseXcstrings.js';

/**
 * Merges one locale's translated slice back into the full on-disk catalog.
 *
 * The catalog is truth for entry existence and every field except the target
 * locale's localization, which is replaced wholesale from the slice (target
 * plural/device categories legitimately differ from the source's). Entries
 * and locales the slice does not mention are preserved verbatim; slice
 * entries with no matching catalog entry are skipped with a warning. Throws
 * on invalid content.
 */
export function mergeXcstrings(
  currentCatalogContent: string,
  translatedSliceContent: string,
  targetLocale: string
): string {
  const catalog = parseXcstringsCatalog(currentCatalogContent);
  const slice = parseXcstringsCatalog(translatedSliceContent);

  const mergedEntries: [string, XcstringsEntry][] = [];
  for (const [key, entry] of Object.entries(catalog.strings)) {
    const sliceEntry = Object.hasOwn(slice.strings, key)
      ? slice.strings[key]
      : undefined;
    const localization =
      sliceEntry?.localizations !== undefined &&
      Object.hasOwn(sliceEntry.localizations, targetLocale)
        ? sliceEntry.localizations[targetLocale]
        : undefined;
    if (localization === undefined) {
      mergedEntries.push([key, entry]);
      continue;
    }
    mergedEntries.push([
      key,
      {
        ...entry,
        localizations: setLocalization(
          entry.localizations ?? {},
          targetLocale,
          localization
        ),
      },
    ]);
  }

  const unmatchedKeys = Object.keys(slice.strings).filter(
    (key) => !Object.hasOwn(catalog.strings, key)
  );
  if (unmatchedKeys.length > 0) {
    logger.warn(
      `Skipped ${unmatchedKeys.length} downloaded ${targetLocale} translation(s) with no matching entry in the local catalog: ${unmatchedKeys
        .map((key) => JSON.stringify(key))
        .join(', ')}`
    );
  }

  return serializeXcstrings({
    ...catalog,
    strings: Object.fromEntries(mergedEntries),
  });
}

/**
 * Clones localizations with the target locale set. An existing locale keeps
 * its position; a new one is inserted at its sorted position among existing
 * keys, so the merged bytes are independent of locale download order while
 * untouched locales never move.
 */
function setLocalization(
  localizations: Record<string, unknown>,
  targetLocale: string,
  localization: unknown
): Record<string, unknown> {
  if (Object.hasOwn(localizations, targetLocale)) {
    return { ...localizations, [targetLocale]: localization };
  }
  const entries = Object.entries(localizations);
  const firstLater = entries.findIndex(([locale]) => targetLocale < locale);
  const insertAt = firstLater === -1 ? entries.length : firstLater;
  entries.splice(insertAt, 0, [targetLocale, localization]);
  return Object.fromEntries(entries);
}
