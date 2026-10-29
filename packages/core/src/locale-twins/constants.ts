import type { TranslationSplittingStrategy } from '../types-dir/config';

/** Translation splitting strategy used when `files.gt.splitting` is unset. */
export const DEFAULT_TRANSLATION_SPLITTING: TranslationSplittingStrategy =
  'locale';

/** Every accepted `files.gt.splitting` value. */
export const TRANSLATION_SPLITTING_STRATEGIES: readonly TranslationSplittingStrategy[] =
  ['locale', 'locale-twins'];

/**
 * Prefix of every unfilled locale twin placeholder. The bare prefix is never a
 * well-formed placeholder on its own: a placeholder must name at least one
 * entry hash, so runtime code that contains this constant never matches.
 */
export const LOCALE_TWIN_PLACEHOLDER_PREFIX = '__GT_LOCALE_TWIN__';

/** Current twin manifest format version. */
export const LOCALE_TWIN_MANIFEST_VERSION = 1;

/** File name of the twin manifest, written at the client output directory root. */
export const LOCALE_TWIN_MANIFEST_FILE = 'gt-locale-twins.json';
