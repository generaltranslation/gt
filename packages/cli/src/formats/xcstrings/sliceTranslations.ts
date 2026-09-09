// An .xcstrings catalog carries its own translations, so the locales it
// already holds are uploaded as per-locale slices of the same file rather than
// as separate translation files. Both `gt upload` and `gt translate` need
// those slices: upload to register them, translate so the run reuses them
// instead of translating over them.

import { getRelative, readFile } from '../../fs/findFilepath.js';
import { gt } from '../../utils/gt.js';
import {
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  sliceTranslationCatalog,
} from './parseXcstrings.js';
import type { FileToUpload } from 'generaltranslation/types';

/**
 * Reads each catalog at `catalogPaths` that is one of `sourceFiles` and
 * returns, keyed by the source's fileName, one translation document per
 * configured locale the catalog carries. Every catalog that is a source gets
 * an entry, empty when it holds none of the locales, so callers can tell a
 * catalog with nothing to upload from a file that is not a catalog. Catalog
 * keys are canonical tags, so a configured alias is resolved before slicing
 * and the slice is uploaded under the alias.
 *
 * Catalogs that are not in `sourceFiles` are skipped: aggregateFiles has
 * already dropped and reported the ones it could not parse.
 */
export function collectXcstringsTranslations({
  sourceFiles,
  catalogPaths,
  locales,
}: {
  sourceFiles: FileToUpload[];
  catalogPaths: string[];
  locales: string[];
}): Map<string, FileToUpload[]> {
  const bySourceName = new Map(
    sourceFiles.map((file) => [file.fileName, file])
  );
  const translations = new Map<string, FileToUpload[]>();
  for (const catalogPath of catalogPaths) {
    const source = bySourceName.get(getRelative(catalogPath));
    if (!source) continue;
    const catalog = parseXcstringsCatalog(readFile(catalogPath));
    const slices: FileToUpload[] = [];
    for (const locale of locales) {
      const slice = sliceTranslationCatalog(
        catalog,
        gt.resolveCanonicalLocale(locale)
      );
      if (!slice) continue;
      slices.push({
        content: serializeXcstringsSlice(slice),
        fileName: source.fileName,
        fileFormat: source.transformFormat ?? source.fileFormat,
        dataFormat: source.dataFormat,
        locale,
        fileId: source.fileId,
        versionId: source.versionId,
      });
    }
    translations.set(source.fileName, slices);
  }
  return translations;
}
