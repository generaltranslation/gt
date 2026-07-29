/**
 * `locales` is the list of translation *targets*. Configs often repeat the
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
export type ResolvedTargetLocales = {
  /** Deduplicated targets, with the source locale removed. */
  targets: string[];
  /** Entries dropped from the input, in the order they appeared. */
  redundant: string[];
};

export function resolveTargetLocales(
  sourceLocale: string,
  locales: string[] | undefined
): ResolvedTargetLocales {
  const seen = new Set<string>([sourceLocale]);
  const targets: string[] = [];
  const redundant: string[] = [];

  for (const locale of locales ?? []) {
    if (seen.has(locale)) {
      redundant.push(locale);
      continue;
    }
    seen.add(locale);
    targets.push(locale);
  }

  return { targets, redundant };
}
