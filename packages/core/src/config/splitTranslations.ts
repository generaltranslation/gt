/**
 * The environment variables that stand in for keys of the compiler's
 * `experimentalSplitTranslations` option, by the key each stands in for. The
 * compiler reads them, and so does a framework plugin that decides whether to
 * run the compiler before it loads it.
 */
export const splitTranslationsEnvNames = {
  enabled: 'GT_SPLIT_TRANSLATIONS',
  by: 'GT_SPLIT_TRANSLATIONS_BY',
  minifyHashes: 'GT_MINIFY_HASHES',
} as const;
