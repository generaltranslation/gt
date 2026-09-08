import type { FileFormat } from 'generaltranslation/types';
import { gt } from '../../utils/gt.js';
import {
  parseXcstringsCatalog,
  serializeXcstringsSlice,
  sliceTranslationCatalog,
} from '../xcstrings/parseXcstrings.js';

/**
 * The content one locale of a translation file stands for on the platform.
 * A file that holds every locale (an .xcstrings catalog) stands for its
 * single-locale slice — what upload sends and download merges back — so the
 * on-disk file and a download compare slice to slice. Every other format
 * stands for the whole file. The catalog is keyed by canonical tags, so a
 * configured alias is resolved first. Undefined when the content carries
 * nothing for the locale. Throws on invalid content.
 */
export function localeContent(
  content: string,
  fileFormat: FileFormat,
  locale: string
): string | undefined {
  if (fileFormat !== 'XCSTRINGS') return content;
  const slice = sliceTranslationCatalog(
    parseXcstringsCatalog(content),
    gt.resolveCanonicalLocale(locale)
  );
  return slice === undefined ? undefined : serializeXcstringsSlice(slice);
}
