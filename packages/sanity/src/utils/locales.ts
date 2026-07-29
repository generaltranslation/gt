/**
 * `locales` is the list of translation *targets*, but configs often repeat the
 * source locale there — spreading `gt.config.json`, which pairs `defaultLocale`
 * with a `locales` array, is the common way to end up with it.
 *
 * A repeated locale is not cosmetic: it reaches
 * `@sanity/document-internationalization` as a duplicate `supportedLanguages`
 * entry, and `sanity-plugin-internationalized-array` then resolves every
 * language after the duplicate to the wrong array index. Its reorder effect
 * rewrites the array, re-renders, and re-flags the same mismatch forever, which
 * crashes the Studio with "Maximum update depth exceeded".
 */
export function resolveTargetLocales(
  sourceLocale: string,
  locales: string[] | undefined
): string[] {
  return Array.from(new Set(locales)).filter(
    (locale) => locale !== sourceLocale
  );
}
